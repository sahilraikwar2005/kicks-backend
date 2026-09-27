export default function CrashFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#090909] px-4">
      <div className="w-full max-w-sm rounded-[24px] border border-white/10 bg-[#141414] p-6 text-center">
        <h1 className="text-xl font-bold text-white">Something went wrong</h1>
        <p className="mt-2 text-sm text-[#a8a8a8]">Please refresh the page. If the problem continues, contact support.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="kicks-btn kicks-btn-primary mt-5 w-full"
        >
          Refresh page
        </button>
      </div>
    </div>
  );
}
