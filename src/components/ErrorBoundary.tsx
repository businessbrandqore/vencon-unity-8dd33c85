import { Component, type ErrorInfo, type ReactNode } from "react";
import { Home, RefreshCcw, Bug } from "lucide-react";

const BRANDING_CACHE_KEY = "vencon_ui_branding";

type BrandingCache = { company_name?: string; company_logo?: string };

interface Props { children: ReactNode }
interface State { hasError: boolean; error: Error | null }

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Vencon ErrorBoundary caught:", error, info.componentStack);
  }

  private getBranding(): BrandingCache {
    try {
      const raw = localStorage.getItem(BRANDING_CACHE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const branding = this.getBranding();

    return (
      <main className="min-h-screen bg-background text-foreground">
        <section className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-6 py-16">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.14),transparent_32%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.3))]" />
          <div className="absolute left-8 top-8 h-24 w-24 rounded-full border border-border bg-card/40 blur-2xl" />
          <div className="absolute bottom-8 right-8 h-40 w-40 rounded-full border border-border bg-primary/10 blur-3xl" />

          <div className="w-full max-w-4xl rounded-[2rem] border border-border bg-card/90 p-8 shadow-2xl backdrop-blur md:p-12">
            <div className="mb-8 flex items-center gap-4">
              {branding.company_logo ? (
                <img src={branding.company_logo} alt="Logo" className="h-14 w-14 rounded-2xl border border-border object-contain bg-background p-2" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-heading text-xl font-bold">V</div>
              )}
              <div>
                <p className="font-body text-xs uppercase tracking-[0.3em] text-muted-foreground">{branding.company_name || "VENCON"}</p>
                <h1 className="font-heading text-3xl font-bold md:text-5xl">কিছু একটা ভুল হয়েছে</h1>
              </div>
            </div>

            <div className="grid gap-8 md:grid-cols-[1.2fr_0.8fr] md:items-center">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                  <Bug className="h-4 w-4" />
                  Application Error
                </div>
                <p className="max-w-2xl font-body text-base leading-7 text-muted-foreground md:text-lg">
                  সিস্টেমে একটি অপ্রত্যাশিত সমস্যা দেখা দিয়েছে। চিন্তা করবেন না — আপনার ডেটা নিরাপদ আছে। পেইজ রিফ্রেশ করলে সমস্যা সমাধান হতে পারে।
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    রিফ্রেশ করুন
                  </button>
                  <a
                    href="/"
                    className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
                  >
                    <Home className="h-4 w-4" />
                    হোমে ফিরুন
                  </a>
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-border bg-background/80 p-6">
                <div className="mb-4 flex items-baseline justify-between border-b border-border pb-4">
                  <span className="font-body text-sm text-muted-foreground">Error Details</span>
                  <span className="font-heading text-5xl font-bold leading-none text-destructive">!</span>
                </div>
                <code className="block max-h-24 overflow-auto rounded-xl bg-secondary px-4 py-3 font-mono text-xs text-foreground">
                  {this.state.error?.message || "Unknown error"}
                </code>
                <p className="mt-4 font-body text-sm leading-6 text-muted-foreground">
                  সমস্যা বারবার হলে, সুপার অ্যাডমিনকে জানান অথবা কিছুক্ষণ পরে আবার চেষ্টা করুন।
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }
}

export default ErrorBoundary;
