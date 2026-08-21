const { useState } = React;

function AppHeader({ screen, hasData, go, onClear }) {
  return (
    <header className="sticky top-0 z-[80] w-full border-b border-border bg-card md:bg-card/80 md:backdrop-blur-md">
      <div className="container mx-auto px-4 h-16 md:h-20 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer group" role="button" tabIndex={0} onClick={() => go('hero')}>
          <div className="w-9 h-9 md:w-10 md:h-10 rounded-2xl bg-gradient-brand flex items-center justify-center text-white shadow-lg group-hover:scale-110 group-hover:rotate-6 transition-all">
            <Icon name="shield-check" size={22} strokeWidth={2.5} />
          </div>
          <span className="font-display font-extrabold text-xl md:text-2xl tracking-tight hidden sm:block">SafeUnfollow<span className="text-primary">.app</span></span>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          {hasData ? (
            <div className="flex items-center gap-2">
              <button onClick={() => go('results')} className={`cursor-pointer flex items-center gap-2 px-3 py-3 md:px-4 md:py-2 rounded-xl text-xs md:text-sm font-bold transition-all ${screen === 'results' ? 'bg-primary text-white shadow-md' : 'text-zinc-500 hover:bg-[oklch(0.5_0_0_/_0.05)]'}`}>
                <Icon name="layout-dashboard" size={18} /><span className="hidden md:inline">Results</span>
              </button>
              <button onClick={onClear} className="cursor-pointer flex items-center gap-2 px-3 py-3 md:px-4 md:py-2 rounded-xl text-xs md:text-sm font-bold text-rose-500 hover:bg-rose-50 transition-all">
                <Icon name="trash-2" size={18} /><span className="hidden md:inline">Delete</span>
              </button>
            </div>
          ) : (
            <button onClick={() => go('upload')} className={`cursor-pointer flex items-center gap-2 px-3 py-3 md:px-4 md:py-2 rounded-xl text-xs md:text-sm font-bold transition-all ${screen === 'upload' ? 'bg-primary text-white shadow-md' : 'text-zinc-500 hover:bg-[oklch(0.5_0_0_/_0.05)]'}`}>
              <Icon name="upload" size={18} /><span className="hidden md:inline">Upload File</span>
            </button>
          )}
          <div className="w-[1px] h-6 md:h-8 bg-border" />
          <button className="cursor-pointer flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs md:text-sm font-bold text-zinc-500 hover:bg-[oklch(0.5_0_0_/_0.05)] transition-all">
            EN <Icon name="chevron-down" size={14} />
          </button>
          <button className="cursor-pointer flex items-center justify-center p-3 md:px-3 md:py-2 rounded-2xl hover:bg-[oklch(0.5_0_0_/_0.05)] transition-colors text-zinc-500">
            <Icon name="sun-moon" size={20} />
          </button>
        </div>
      </div>
    </header>
  );
}

function AppFooter() {
  const links = ['Privacy Policy', 'Terms of Service', 'Docs', 'Troubleshooting', 'Accessibility', 'Contact', "Don't Track Me", 'Source Code'];
  return (
    <footer className="mt-12 lg:mt-20 border-t border-border bg-card py-10 lg:py-14">
      <div className="container mx-auto px-4">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-10 lg:gap-20">
          <div className="text-center lg:text-start">
            <div className="font-bold text-2xl mb-6 flex items-center justify-center lg:justify-start gap-4 group">
              <img src="../../assets/logo.svg" width="56" height="56" alt="" className="shadow-2xl rounded-3xl group-hover:rotate-12 transition-transform" />
              <span className="text-3xl lg:text-5xl font-display font-extrabold tracking-tight leading-none">SafeUnfollow<span className="text-primary">.app</span></span>
            </div>
            <p className="text-zinc-500 max-w-sm text-base lg:text-lg leading-relaxed font-medium mx-auto lg:mx-0">The only relationship analyzer that works 100% in your browser. No server, no logs, just your data and your device.</p>
          </div>
          <div className="flex flex-col items-center lg:items-end gap-8">
            <div className="flex flex-wrap items-center justify-center lg:justify-end gap-x-12 gap-y-6 text-xs lg:text-sm font-black uppercase tracking-widest text-zinc-400">
              {links.map(l => <a key={l} href="#" className="hover:text-primary transition-colors py-2 px-1 cursor-pointer no-underline text-inherit">{l}</a>)}
            </div>
            <div className="bg-[oklch(0.5_0_0_/_0.03)] p-6 lg:p-8 rounded-3xl border border-border flex flex-col items-center gap-5 shadow-sm w-full lg:w-auto">
              <p className="text-xs lg:text-sm font-black text-zinc-500 uppercase tracking-widest leading-none">This tool has no ads and no investors.</p>
              <a href="#" className="group flex items-center gap-4 px-10 py-5 bg-primary text-primary-foreground rounded-2xl font-black text-sm lg:text-lg shadow-xl hover:scale-105 active:scale-95 transition-all w-full lg:w-auto justify-center cursor-pointer no-underline">
                <Icon name="coffee" size={22} /><span>Buy a Coffee</span>
              </a>
            </div>
          </div>
        </div>
        <div className="mt-8 lg:mt-10 flex flex-col lg:flex-row items-center justify-between gap-4 border-t border-border pt-6 text-sm text-zinc-400 font-bold">
          <div className="flex items-center gap-2">Made with <Icon name="heart" size={16} className="text-rose-500" /> for the Community</div>
          <div className="flex flex-wrap items-center justify-center gap-4 lg:gap-10">
            <span>© 2026 SafeUnfollow.app</span>
            <span className="hidden lg:block w-1.5 h-1.5 rounded-full bg-border" />
            <span className="text-primary opacity-90 uppercase tracking-tighter">MIT Licensed</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

Object.assign(window, { AppHeader, AppFooter });
