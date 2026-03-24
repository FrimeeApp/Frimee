import { NextRequest, NextResponse } from "next/server";


export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ toxic: false });
  }

  try {
    const { text } = (await req.json()) as { text: string };
    if (!text?.trim()) {
      return NextResponse.json({ toxic: false });
    }

    const res = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: "omni-moderation-latest", input: text }),
    });

    if (!res.ok) {
      return NextResponse.json({ toxic: false });
    }

    const data = (await res.json()) as {
      results: {
        flagged: boolean;
        categories: Record<string, boolean>;
        category_scores: Record<string, number>;
      }[];
    };

    const result = data.results[0];
    if (!result) return NextResponse.json({ toxic: false });

    return NextResponse.json({ toxic: result.flagged });
  } catch {
    return NextResponse.json({ toxic: false });
  }
}
