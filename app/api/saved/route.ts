import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET() {
  const result = await db.execute(sql`SELECT github_id, full_name, html_url, description, language, stars, forks, avatar_url, created_at FROM saved_repositories ORDER BY created_at DESC LIMIT 100`)
  return NextResponse.json({ items: result.rows })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body || !Number.isInteger(body.githubId) || typeof body.fullName !== 'string' || typeof body.htmlUrl !== 'string') return NextResponse.json({ error: 'Repository ma’lumotlari noto‘g‘ri' }, { status: 400 })
  const result = await db.execute(sql`INSERT INTO saved_repositories (github_id, full_name, html_url, description, language, stars, forks, avatar_url) VALUES (${body.githubId}, ${body.fullName.slice(0, 200)}, ${body.htmlUrl.slice(0, 500)}, ${body.description?.slice(0, 1000) || null}, ${body.language?.slice(0, 80) || null}, ${Number(body.stars) || 0}, ${Number(body.forks) || 0}, ${body.avatarUrl?.slice(0, 500) || null}) ON CONFLICT (github_id) DO UPDATE SET full_name = EXCLUDED.full_name RETURNING github_id`)
  return NextResponse.json({ saved: true, id: result.rows[0]?.github_id })
}

export async function DELETE(request: NextRequest) {
  const id = Number(request.nextUrl.searchParams.get('githubId'))
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'githubId kerak' }, { status: 400 })
  await db.execute(sql`DELETE FROM saved_repositories WHERE github_id = ${id}`)
  return NextResponse.json({ saved: false })
}
