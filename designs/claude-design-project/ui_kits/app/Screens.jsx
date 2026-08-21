function HeroScreen({ go, loadSample, hasData }) {
  const features = [
    ['shield', 'text-emerald-500', '100% Local', 'No data ever leaves your device'],
    ['ban', 'text-rose-500', 'No Login', 'No risk of account bans or hacking'],
    ['infinity', 'text-indigo-500', 'High Scale', 'Handles 1M+ accounts at light speed'],
    ['code', 'text-amber-500', 'Open Source', 'Audit our code, we value your trust'],
  ];
  const trust = ['Completely Free • Forever', 'No Password • No Account Risk', '100% Private • Local Analysis'];
  return (
    <section className="py-12 md:py-32 text-center max-w-5xl mx-auto flex flex-col items-center animate-in fade-in duration-700">
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary font-bold text-xs mb-8 md:mb-12 border border-primary/20 backdrop-blur-md shadow-sm">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
        </span>
        V1.6 Optimized for 1,000,000+ Accounts
      </div>
      <h1 className="text-4xl md:text-7xl lg:text-8xl font-display font-extrabold tracking-tight mb-8 leading-[1.0] text-balance px-4 text-zinc-900">
        Check <span className="text-gradient">Instagram Unfollowers</span> <br className="hidden md:block" />Without Logging In
      </h1>
      <p className="text-base md:text-xl lg:text-2xl text-zinc-500 mb-10 md:mb-14 max-w-2xl mx-auto font-medium px-6 leading-relaxed">
        Find out who unfollowed you on Instagram — free, no login required. Upload your ZIP file, analyze locally. 100% Private. Works offline.
      </p>
      <div className="flex flex-col items-center gap-6 mb-20 md:mb-32 w-full max-w-3xl px-4">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full">
          <button onClick={() => go(hasData ? 'results' : 'wizard')} className="cursor-pointer w-full sm:w-auto px-10 md:px-12 py-4 md:py-5 rounded-3xl bg-primary text-white font-bold text-base md:text-lg shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 group">
            {hasData ? 'View Analysis Results' : 'Check Unfollowers Free'}
            <Icon name="arrow-right" size={20} className="group-hover:translate-x-1 transition-transform" />
          </button>
          <button onClick={loadSample} className="cursor-pointer w-full sm:w-auto px-8 md:px-10 py-4 md:py-5 rounded-3xl border border-border bg-card font-bold text-base md:text-lg hover:bg-zinc-50 transition-all flex items-center justify-center gap-2">
            <Icon name="database" size={20} className="text-accent" />Try with Sample
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs md:text-sm text-zinc-500 font-semibold">
          {trust.map(t => <div key={t} className="flex items-center gap-1.5"><Icon name="circle-check-big" size={16} className="text-emerald-500" /> {t}</div>)}
        </div>
        {!hasData && (
          <button onClick={() => go('upload')} className="cursor-pointer text-zinc-400 hover:text-primary font-bold text-xs uppercase tracking-widest transition-all underline underline-offset-4 decoration-zinc-200 bg-transparent border-0">
            I already have my ZIP file
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8 w-full max-w-6xl px-4">
        {features.map(([icon, color, title, desc]) => (
          <div key={title} className="p-6 md:p-10 rounded-4xl border border-border bg-card text-start shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-default group flex flex-col items-start">
            <div className="mb-6 flex justify-center group-hover:scale-110 transition-transform"><Icon name={icon} size={24} className={color} /></div>
            <div className="font-bold text-sm md:text-lg mb-2 leading-tight">{title}</div>
            <div className="text-xs md:text-sm text-zinc-500 leading-relaxed">{desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

const STEPS = [
  ['Open Instagram Export Page', 'Click the button to open Meta Accounts Center. Then click "Create export" to begin the process.', false],
  ['Choose Your Instagram Profile', 'Select your Instagram account from the list of connected profiles in the Accounts Center.', false],
  ['Select "Export to device"', 'Choose to export directly to your device. This keeps your data private and secure.', false],
  ['Select Only "Followers and following"', 'Click "Customize" → Clear all → Check ONLY "Followers and following". This keeps your file compact.', false],
  ['Set Date Range to "All time"', 'Click "Date range" → Select "All time" → Save. This ensures complete follower history.', false],
  ['Change Format to JSON', 'Critical step! Click "Format" → Select "JSON" (not HTML). HTML files will NOT work.', true],
  ['Review & Start Export', 'Verify settings: Followers and following, All time, JSON. Then click "Start export".', false],
  ['Wait for Email & Download', 'Instagram emails you when ready (5-30 min). Download the ZIP file from the email link.', false],
  ['Upload Your File', "You're ready! Click the button below to upload your Instagram data and see who unfollowed you.", false],
];

function WizardScreen({ go }) {
  return (
    <section className="py-12 md:py-20 max-w-5xl mx-auto px-4">
      <h2 className="text-3xl md:text-5xl font-display font-extrabold tracking-tight text-center mb-4">How to Check Your <span className="text-gradient">Instagram Unfollowers</span></h2>
      <p className="text-center text-zinc-500 font-medium text-base md:text-lg max-w-2xl mx-auto mb-12">Follow these 9 simple steps to securely analyze your account without sharing your password.</p>
      <div className="grid md:grid-cols-3 gap-4 md:gap-6">
        {STEPS.map(([title, desc, critical], i) => (
          <div key={title} className="p-6 rounded-3xl border border-border bg-card shadow-sm hover:shadow-lg transition-all flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary font-black text-sm flex items-center justify-center">{i + 1}</span>
              {critical && <span className="text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border bg-[oklch(0.6_0.22_25_/_0.15)] text-[oklch(0.55_0.25_25)] border-[oklch(0.6_0.22_25_/_0.3)] leading-none">Critical</span>}
            </div>
            <div className="font-bold text-sm md:text-base leading-tight">{title}</div>
            <div className="text-xs md:text-sm text-zinc-500 leading-relaxed">{desc}</div>
          </div>
        ))}
      </div>
      <div className="mt-12 flex justify-center">
        <button onClick={() => go('upload')} className="cursor-pointer px-10 py-5 rounded-3xl bg-primary text-white font-bold text-lg shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 group">
          Upload My File <Icon name="arrow-right" size={20} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </section>
  );
}

function UploadScreen({ onDrop }) {
  const [over, setOver] = React.useState(false);
  return (
    <section className="py-12 md:py-24 max-w-3xl mx-auto px-4">
      <h2 className="text-3xl md:text-5xl font-display font-extrabold tracking-tight text-center mb-4">Upload your export</h2>
      <p className="text-center text-zinc-500 font-medium text-base md:text-lg mb-12">The ZIP is read in your browser. Nothing is uploaded anywhere.</p>
      <div
        onDragOver={e => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); onDrop(); }}
        onClick={onDrop}
        className={`cursor-pointer rounded-4xl border-2 border-dashed p-12 md:p-20 flex flex-col items-center gap-6 text-center transition-all ${over ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border bg-card hover:border-primary/40'}`}>
        <div className="w-20 h-20 rounded-3xl bg-gradient-brand flex items-center justify-center text-white shadow-2xl shadow-primary/30">
          <Icon name="upload" size={34} strokeWidth={2.5} />
        </div>
        <div className="font-display font-extrabold text-xl md:text-3xl tracking-tight">Drop your instagram ZIP here</div>
        <div className="text-sm md:text-base text-zinc-500 font-medium max-w-md leading-relaxed">Or click to browse. We accept the JSON export from Meta Accounts Center — up to 1,000,000 accounts.</div>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-semibold text-zinc-500">
          <span className="flex items-center gap-1.5"><Icon name="circle-check-big" size={14} className="text-emerald-500" />.zip or .json</span>
          <span className="flex items-center gap-1.5"><Icon name="circle-check-big" size={14} className="text-emerald-500" />Never uploaded</span>
          <span className="flex items-center gap-1.5"><Icon name="circle-check-big" size={14} className="text-emerald-500" />Works offline</span>
        </div>
      </div>
      <div className="mt-8 p-5 rounded-3xl border border-border bg-[oklch(0.5_0_0_/_0.03)] flex items-start gap-4">
        <Icon name="circle-alert" size={20} className="text-amber-500" style={{ marginTop: 2 }} />
        <div className="text-sm text-zinc-500 leading-relaxed"><span className="font-bold text-zinc-900">HTML exports will not work.</span> Re-run the export and set Format to JSON — it is step 6 in the guide.</div>
      </div>
    </section>
  );
}

Object.assign(window, { HeroScreen, WizardScreen, UploadScreen });
