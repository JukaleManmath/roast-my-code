/**
 * Tests for components/InputPanel.tsx
 *
 * InputPanel is the main code submission form with three tabs (paste / file / github).
 * We mock:
 *  - next/navigation's useRouter so we can assert router.push calls
 *  - @/lib/api's submitReview and submitFileReview so no real network calls happen
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InputPanel } from '@/components/InputPanel'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

const mockSubmitReview = jest.fn()
const mockSubmitFileReview = jest.fn()
jest.mock('@/lib/api', () => ({
  submitReview: (...args: unknown[]) => mockSubmitReview(...args),
  submitFileReview: (...args: unknown[]) => mockSubmitFileReview(...args),
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string) {
      super(message)
      this.name = 'ApiError'
    }
  },
}))

beforeEach(() => {
  jest.clearAllMocks()
})

// ── Helpers ───────────────────────────────────────────────────────────────────

async function selectLanguage(user: ReturnType<typeof userEvent.setup>, lang: string) {
  await user.selectOptions(screen.getByRole('combobox'), lang)
}

async function clickSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /start review/i }))
}

// ── Tab rendering ─────────────────────────────────────────────────────────────

describe('InputPanel — tab navigation', () => {
  test('renders all three tabs', () => {
    render(<InputPanel />)
    expect(screen.getByRole('button', { name: /paste code/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /upload file/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /github url/i })).toBeInTheDocument()
  })

  test('paste tab is active by default — shows textarea', () => {
    render(<InputPanel />)
    expect(screen.getByPlaceholderText(/paste your code here/i)).toBeInTheDocument()
  })

  test('switching to GitHub tab shows URL input', async () => {
    const user = userEvent.setup()
    render(<InputPanel />)
    await user.click(screen.getByRole('button', { name: /github url/i }))
    expect(screen.getByPlaceholderText(/https:\/\/github\.com/i)).toBeInTheDocument()
  })

  test('switching to Upload tab shows file drop zone', async () => {
    const user = userEvent.setup()
    render(<InputPanel />)
    await user.click(screen.getByRole('button', { name: /upload file/i }))
    expect(screen.getByText(/drop a file or click to browse/i)).toBeInTheDocument()
  })
})

// ── Validation: language required ─────────────────────────────────────────────

describe('InputPanel — language validation', () => {
  test('shows error when submitting without selecting a language', async () => {
    const user = userEvent.setup()
    render(<InputPanel />)
    await user.type(screen.getByPlaceholderText(/paste your code here/i), 'def foo(): pass')
    await clickSubmit(user)

    expect(screen.getByText(/select a language/i)).toBeInTheDocument()
    expect(mockSubmitReview).not.toHaveBeenCalled()
  })
})

// ── Paste tab: validation & happy path ───────────────────────────────────────

describe('InputPanel — paste tab', () => {
  test('shows error when code is empty', async () => {
    const user = userEvent.setup()
    render(<InputPanel />)
    await selectLanguage(user, 'Python')
    await clickSubmit(user)

    expect(screen.getByText(/paste some code first/i)).toBeInTheDocument()
    expect(mockSubmitReview).not.toHaveBeenCalled()
  })

  test('calls submitReview with correct payload', async () => {
    const user = userEvent.setup()
    mockSubmitReview.mockResolvedValueOnce({ id: 'rev-123' })
    render(<InputPanel />)

    await user.type(screen.getByPlaceholderText(/paste your code here/i), 'def foo(): pass')
    await selectLanguage(user, 'Python')
    await clickSubmit(user)

    await waitFor(() => expect(mockSubmitReview).toHaveBeenCalledWith({
      input_mode: 'paste',
      code: 'def foo(): pass',
      language: 'Python',
    }))
  })

  test('navigates to /review/{id} on success', async () => {
    const user = userEvent.setup()
    mockSubmitReview.mockResolvedValueOnce({ id: 'rev-456' })
    render(<InputPanel />)

    await user.type(screen.getByPlaceholderText(/paste your code here/i), 'def foo(): pass')
    await selectLanguage(user, 'Python')
    await clickSubmit(user)

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/review/rev-456'))
  })

  test('shows API error message when submission fails', async () => {
    const user = userEvent.setup()
    const { ApiError } = jest.requireMock('@/lib/api')
    mockSubmitReview.mockRejectedValueOnce(new ApiError(400, 'Code is too short.'))
    render(<InputPanel />)

    await user.type(screen.getByPlaceholderText(/paste your code here/i), 'x')
    await selectLanguage(user, 'Python')
    await clickSubmit(user)

    await waitFor(() => expect(screen.getByText('Code is too short.')).toBeInTheDocument())
  })

  test('shows generic error for non-ApiError exceptions', async () => {
    const user = userEvent.setup()
    mockSubmitReview.mockRejectedValueOnce(new Error('Network failure'))
    render(<InputPanel />)

    await user.type(screen.getByPlaceholderText(/paste your code here/i), 'def foo(): pass')
    await selectLanguage(user, 'Python')
    await clickSubmit(user)

    await waitFor(() => expect(screen.getByText(/something went wrong/i)).toBeInTheDocument())
  })

  test('submit button shows loading state during submission', async () => {
    const user = userEvent.setup()
    // Never resolves — keeps the loading state indefinitely
    mockSubmitReview.mockReturnValueOnce(new Promise(() => {}))
    render(<InputPanel />)

    await user.type(screen.getByPlaceholderText(/paste your code here/i), 'def foo(): pass')
    await selectLanguage(user, 'Python')
    await clickSubmit(user)

    expect(screen.getByText(/submitting/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submitting/i })).toBeDisabled()
  })
})

// ── GitHub tab: validation & happy path ──────────────────────────────────────

describe('InputPanel — github tab', () => {
  test('shows error when URL is empty', async () => {
    const user = userEvent.setup()
    render(<InputPanel />)
    await user.click(screen.getByRole('button', { name: /github url/i }))
    await selectLanguage(user, 'Python')
    await clickSubmit(user)

    expect(screen.getByText(/enter a github url/i)).toBeInTheDocument()
    expect(mockSubmitReview).not.toHaveBeenCalled()
  })

  test('calls submitReview with github input_mode and url', async () => {
    const user = userEvent.setup()
    mockSubmitReview.mockResolvedValueOnce({ id: 'rev-gh-1' })
    render(<InputPanel />)

    await user.click(screen.getByRole('button', { name: /github url/i }))
    await user.type(
      screen.getByPlaceholderText(/https:\/\/github\.com/i),
      'https://github.com/owner/repo'
    )
    await selectLanguage(user, 'Go')
    await clickSubmit(user)

    await waitFor(() => expect(mockSubmitReview).toHaveBeenCalledWith({
      input_mode: 'github',
      github_url: 'https://github.com/owner/repo',
      language: 'Go',
    }))
  })
})

// ── File tab: validation & happy path ────────────────────────────────────────

describe('InputPanel — file tab', () => {
  test('shows error when no file is selected', async () => {
    const user = userEvent.setup()
    render(<InputPanel />)
    await user.click(screen.getByRole('button', { name: /upload file/i }))
    await selectLanguage(user, 'Python')
    await clickSubmit(user)

    expect(screen.getByText(/select a file first/i)).toBeInTheDocument()
    expect(mockSubmitFileReview).not.toHaveBeenCalled()
  })

  test('calls submitFileReview with file and language', async () => {
    const user = userEvent.setup()
    mockSubmitFileReview.mockResolvedValueOnce({ id: 'rev-file-1' })
    render(<InputPanel />)

    await user.click(screen.getByRole('button', { name: /upload file/i }))

    const file = new File(['def foo(): pass'], 'hello.py', { type: 'text/plain' })
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
    await user.upload(input, file)

    await selectLanguage(user, 'Python')
    await clickSubmit(user)

    await waitFor(() => expect(mockSubmitFileReview).toHaveBeenCalledWith(file, 'Python'))
  })

  test('shows uploaded filename in the drop zone', async () => {
    const user = userEvent.setup()
    render(<InputPanel />)
    await user.click(screen.getByRole('button', { name: /upload file/i }))

    const file = new File(['x=1'], 'mycode.py', { type: 'text/plain' })
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
    await user.upload(input, file)

    expect(screen.getByText('mycode.py')).toBeInTheDocument()
  })
})
