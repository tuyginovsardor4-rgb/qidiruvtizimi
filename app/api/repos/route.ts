import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim() || 'stars:>1000'
  const language = request.nextUrl.searchParams.get('language')?.trim()
  const page = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get('page') || 1)))
  const perPage = Math.min(30, Math.max(1, Number(request.nextUrl.searchParams.get('perPage') || 10)))
  const searchQuery = [query, language && language !== 'Barchasi' ? `language:${language}` : ''].filter(Boolean).join(' ')
  if (searchQuery.length > 256) return NextResponse.json({ error: 'Qidiruv so‘zi juda uzun' }, { status: 400 })
  const url = new URL('https://api.github.com/search/repositories')
  url.searchParams.set('q', searchQuery)
  url.searchParams.set('sort', 'stars')
  url.searchParams.set('order', 'desc')
  url.searchParams.set('per_page', String(perPage))
  url.searchParams.set('page', String(page))

  const headers: HeadersInit = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  let response: Response
  try {
    response = await fetch(url, { headers, next: { revalidate: 60 }, signal: AbortSignal.timeout(8000) })
  } catch {
    return NextResponse.json({ error: 'GitHub API vaqtida javob bermadi' }, { status: 504 })
  }
  if (!response.ok) {
    const message = response.status === 403 ? 'GitHub rate limit tugagan. Tokenni tekshiring.' : response.status === 422 ? 'Qidiruv formati noto‘g‘ri.' : 'GitHub API so‘rovi bajarilmadi'
    return NextResponse.json({ error: message }, { status: response.status })
  }
  const data = await response.json()
  const items = data.items.map((repo: Record<string, unknown>) => ({
    id: repo.id, name: repo.name, fullName: repo.full_name, description: repo.description, language: repo.language || 'Noma’lum',
    stars: repo.stargazers_count, forks: repo.forks_count, updatedAt: repo.updated_at, htmlUrl: repo.html_url, avatar: repo.owner && (repo.owner as Record<string, unknown>).avatar_url,
  }))
  try { await db.execute(sql`INSERT INTO repo_searches (query, language, results) VALUES (${query}, ${language || null}, ${JSON.stringify(items)}::jsonb)`)} catch { /* database logging should not block search */ }
  return NextResponse.json({ total: data.total_count, items })
}
