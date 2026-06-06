import { Component } from 'react'

/** Keeps a single widget crash from white-screening the whole board. */
export class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-lg font-semibold">Something went sideways.</p>
          <p className="max-w-sm text-sm text-muted">
            {String(this.state.error?.message || this.state.error)}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="text-xs text-muted hover:underline"
          >
            Reload app
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
