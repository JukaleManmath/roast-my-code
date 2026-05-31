/**
 * Tests for components/ReviewHistory.tsx
 *
 * ReviewHistory is a pure presentational component with one piece of local state:
 * the two-step delete confirmation. It takes reviews[] and onDelete() as props.
 */

import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReviewHistory } from '@/components/ReviewHistory'
import type { ReviewSummary } from '@/lib/api'

// next/link renders as a regular anchor in jsdom
jest.mock('next/link', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function MockLink({ href, children }: any) {
    return <a href={href}>{children}</a>
  }
})

function makeReview(overrides: Partial<ReviewSummary> = {}): ReviewSummary {
  return {
    id: 'rev-001',
    status: 'done',
    language: 'Python',
    filename: 'app.py',
    share_slug: 'abc12345',
    created_at: '2026-01-15T12:00:00Z',
    completed_at: '2026-01-15T12:01:00Z',
    ...overrides,
  }
}

// ── Empty state ───────────────────────────────────────────────────────────────

describe('ReviewHistory — empty state', () => {
  test('shows "No reviews yet." when reviews array is empty', () => {
    render(<ReviewHistory reviews={[]} onDelete={jest.fn()} />)
    expect(screen.getByText('No reviews yet.')).toBeInTheDocument()
  })

  test('shows a link back to home in empty state', () => {
    render(<ReviewHistory reviews={[]} onDelete={jest.fn()} />)
    expect(screen.getByRole('link', { name: /review some code/i })).toHaveAttribute('href', '/')
  })
})

// ── List rendering ────────────────────────────────────────────────────────────

describe('ReviewHistory — list rendering', () => {
  test('renders one row per review', () => {
    const reviews = [
      makeReview({ id: 'r1', filename: 'main.py' }),
      makeReview({ id: 'r2', filename: 'server.go', language: 'Go' }),
    ]
    render(<ReviewHistory reviews={reviews} onDelete={jest.fn()} />)
    expect(screen.getByText('main.py')).toBeInTheDocument()
    expect(screen.getByText('server.go')).toBeInTheDocument()
  })

  test('each row links to the correct review page', () => {
    const review = makeReview({ id: 'rev-abc', filename: 'hello.py' })
    render(<ReviewHistory reviews={[review]} onDelete={jest.fn()} />)
    const link = screen.getByRole('link', { name: /hello\.py/i })
    expect(link).toHaveAttribute('href', '/review/rev-abc')
  })

  test('falls back to language name when filename is null', () => {
    const review = makeReview({ filename: null, language: 'Rust' })
    render(<ReviewHistory reviews={[review]} onDelete={jest.fn()} />)
    expect(screen.getByText('Rust')).toBeInTheDocument()
  })

  test('shows status and date in each row', () => {
    const review = makeReview({ status: 'done', created_at: '2026-03-10T12:00:00Z' })
    render(<ReviewHistory reviews={[review]} onDelete={jest.fn()} />)
    expect(screen.getByText(/done/i)).toBeInTheDocument()
    expect(screen.getByText(/3\/10\/2026/i)).toBeInTheDocument()
  })
})

// ── Delete confirmation flow ──────────────────────────────────────────────────

describe('ReviewHistory — delete flow', () => {
  test('clicking the trash icon shows Delete and Cancel buttons', async () => {
    const user = userEvent.setup()
    const review = makeReview()
    render(<ReviewHistory reviews={[review]} onDelete={jest.fn()} />)

    await user.click(screen.getByRole('button', { name: /delete review/i }))

    expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  test('clicking Cancel hides Delete/Cancel and restores trash icon', async () => {
    const user = userEvent.setup()
    const review = makeReview()
    render(<ReviewHistory reviews={[review]} onDelete={jest.fn()} />)

    await user.click(screen.getByRole('button', { name: /delete review/i }))
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /delete review/i })).toBeInTheDocument()
  })

  test('clicking Delete calls onDelete with the review id', async () => {
    const user = userEvent.setup()
    const onDelete = jest.fn()
    const review = makeReview({ id: 'target-id' })
    render(<ReviewHistory reviews={[review]} onDelete={onDelete} />)

    await user.click(screen.getByRole('button', { name: /delete review/i }))
    await user.click(screen.getByRole('button', { name: /^delete$/i }))

    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledWith('target-id')
  })

  test('only shows confirmation for the clicked row when multiple reviews exist', async () => {
    const user = userEvent.setup()
    const reviews = [
      makeReview({ id: 'r1', filename: 'a.py' }),
      makeReview({ id: 'r2', filename: 'b.py' }),
    ]
    render(<ReviewHistory reviews={reviews} onDelete={jest.fn()} />)

    // Click the trash for the first row only
    const trashButtons = screen.getAllByRole('button', { name: /delete review/i })
    await user.click(trashButtons[0])

    // Only one confirmation set should appear
    expect(screen.getAllByRole('button', { name: /^delete$/i })).toHaveLength(1)
  })
})
