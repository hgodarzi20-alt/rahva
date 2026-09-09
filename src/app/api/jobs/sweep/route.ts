import { NextResponse } from "next/server";
import { sweep } from "@/lib/sweep";

/** گذارهای زمان‌محور ماشین حالت — گزینه ج مصوب */
export async function POST() {
  return NextResponse.json(await sweep());
}
export async function GET() {
  return NextResponse.json(await sweep());
}
