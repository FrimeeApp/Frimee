import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ── Tipos ────────────────────────────────────────────────────────────────────

type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: UsuariosRow;
  old_record: UsuariosRow;
};

type UsuariosRow = {
  id: string;
  nombre: string;
  profile_image: string | null;
};

// ── Google auth (JWT RS256 → access token) ──────────────────────────────────

async function getGoogleAccessToken(): Promise<string> {
  const clientEmail = Deno.env.get("FIREBASE_CLIENT_EMAIL")!;
  const rawKey = Deno.env.get("FIREBASE_PRIVATE_KEY")!;
  const privateKey = rawKey.replace(/\\n/g, "\n");

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const signingInput = `${encode(header)}.${encode(payload)}`;

  const pemBody = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\n/g, "");
  const keyBuffer = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${signingInput}.${sigB64}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json() as { access_token: string };
  return tokenData.access_token;
}

// ── Firestore helpers ────────────────────────────────────────────────────────

const PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID")!;
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function queryDocsByField(params: {
  collectionId: string;
  allDescendants: boolean;
  fieldPath: string;
  userId: string;
  token: string;
  parentPath?: string;
}): Promise<string[]> {
  const base = params.parentPath
    ? `https://firestore.googleapis.com/v1/${params.parentPath}`
    : FIRESTORE_BASE;

  const res = await fetch(`${base}:runQuery`, {
    method: "POST",
    headers: { Authorization: `Bearer ${params.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: params.collectionId, allDescendants: params.allDescendants }],
        where: {
          fieldFilter: {
            field: { fieldPath: params.fieldPath },
            op: "EQUAL",
            value: { stringValue: params.userId },
          },
        },
      },
    }),
  });

  const results = await res.json() as Array<{ document?: { name?: string } }>;
  return results
    .map((r) => r.document?.name)
    .filter((name): name is string => Boolean(name));
}

async function patchDoc(
  docName: string,
  fields: Record<string, unknown>,
  maskPaths: string[],
  token: string,
): Promise<void> {
  const mask = maskPaths.map((p) => `updateMask.fieldPaths=${encodeURIComponent(p)}`).join("&");
  await fetch(`https://firestore.googleapis.com/v1/${docName}?${mask}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
}

// ── Handler principal ────────────────────────────────────────────────────────

serve(async (req) => {
  try {
    const payload = await req.json() as WebhookPayload;

    if (payload.type !== "UPDATE") {
      return new Response(JSON.stringify({ ok: true, skipped: "not an update" }), { status: 200 });
    }

    const { record, old_record } = payload;
    const nameChanged = record.nombre !== old_record.nombre;
    const imageChanged = record.profile_image !== old_record.profile_image;

    if (!nameChanged && !imageChanged) {
      return new Response(JSON.stringify({ ok: true, skipped: "no relevant changes" }), { status: 200 });
    }

    const userId = record.id;
    const token = await getGoogleAccessToken();

    // Buscar posts del usuario
    const postDocNames = await queryDocsByField({
      collectionId: "posts",
      allDescendants: false,
      fieldPath: "creator.id",
      userId,
      token,
    });

    // Buscar comentarios dentro de cada post del usuario (sin collection group)
    const commentDocNamesNested = await Promise.all(
      postDocNames.map((postName) =>
        queryDocsByField({
          collectionId: "comments",
          allDescendants: false,
          fieldPath: "user_id",
          userId,
          token,
          parentPath: postName,
        })
      ),
    );
    const commentDocNames = commentDocNamesNested.flat();

    // Actualizar posts (creator.name, creator.profileImage)
    const updatePosts = postDocNames.map((docName) =>
      patchDoc(
        docName,
        {
          creator: {
            mapValue: {
              fields: {
                id: { stringValue: userId },
                name: { stringValue: record.nombre },
                profileImage: record.profile_image
                  ? { stringValue: record.profile_image }
                  : { nullValue: null },
              },
            },
          },
        },
        ["creator"],
        token,
      )
    );

    // Actualizar comentarios (user_name, y profile_image si cambió)
    const updateComments = commentDocNames.map((docName) => {
      const fields: Record<string, unknown> = {
        user_name: { stringValue: record.nombre },
      };
      if (imageChanged) {
        fields.profile_image = record.profile_image
          ? { stringValue: record.profile_image }
          : { nullValue: null };
      }
      const maskPaths = imageChanged ? ["user_name", "profile_image"] : ["user_name"];
      return patchDoc(docName, fields, maskPaths, token);
    });

    await Promise.all([...updatePosts, ...updateComments]);

    console.log(
      `[sync-firebase-creator] user=${userId} | posts=${postDocNames.length} | comments=${commentDocNames.length}`,
    );

    return new Response(
      JSON.stringify({ ok: true, posts: postDocNames.length, comments: commentDocNames.length }),
      { status: 200 },
    );
  } catch (err) {
    console.error("[sync-firebase-creator] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
