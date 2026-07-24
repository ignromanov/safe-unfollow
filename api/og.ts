import { ImageResponse } from '@vercel/og';

export const config = {
  runtime: 'edge',
};

// Inlined from src/config/languages.ts (Edge Functions can't import from src/)
const SUPPORTED_LANGUAGES = ['en', 'es', 'pt', 'hi', 'id', 'tr', 'ja', 'ru', 'de', 'ar'] as const;

type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const RTL_LANGUAGES: SupportedLanguage[] = ['ar'];

interface OgTranslations {
  subtitle: string;
  free: string;
  noPassword: string;
  privacy: string;
}

const translations: Record<SupportedLanguage, OgTranslations> = {
  en: {
    subtitle: 'Check who unfollowed you on Instagram — 100% private, no login required',
    free: '✓ Free Forever',
    noPassword: '✓ No Password',
    privacy: '✓ 100% Local',
  },
  es: {
    subtitle: 'Descubre quién dejó de seguirte en Instagram — 100% privado, sin login',
    free: '✓ 100% Gratis',
    noPassword: '✓ Sin Contraseña',
    privacy: '✓ Análisis Local',
  },
  pt: {
    subtitle: 'Descubra quem parou de te seguir no Instagram — 100% privado, sem login',
    free: '✓ Gratuito',
    noPassword: '✓ Sem Senha',
    privacy: '✓ 100% Local',
  },
  ru: {
    subtitle: 'Узнай, кто отписался в Instagram — 100% приватно, без входа в аккаунт',
    free: '✓ Бесплатно',
    noPassword: '✓ Без пароля',
    privacy: '✓ Локально',
  },
  de: {
    subtitle: 'Finde Entfolger auf Instagram — 100% privat, kein Login erforderlich',
    free: '✓ Kostenlos',
    noPassword: '✓ Kein Passwort',
    privacy: '✓ 100% Lokal',
  },
  hi: {
    subtitle: 'इंस्टाग्राम पर अनफॉलोअर्स देखें — 100% प्राइवेट, बिना लॉगिन',
    free: '✓ फ्री',
    noPassword: '✓ बिना पासवर्ड',
    privacy: '✓ 100% लोकल',
  },
  ja: {
    subtitle: 'Instagramのフォロー解除を確認 — 100%プライベート、ログイン不要',
    free: '✓ 永久無料',
    noPassword: '✓ パスワード不要',
    privacy: '✓ 100%ローカル',
  },
  tr: {
    subtitle: 'Instagram takibi bırakanları gör — 100% gizli, giriş yok',
    free: '✓ Ücretsiz',
    noPassword: '✓ Şifre Yok',
    privacy: '✓ %100 Yerel',
  },
  id: {
    subtitle: 'Cek siapa yang unfollow di Instagram — 100% privat, tanpa login',
    free: '✓ Gratis',
    noPassword: '✓ Tanpa Password',
    privacy: '✓ 100% Lokal',
  },
  ar: {
    subtitle: 'اكتشف من ألغى متابعتك على إنستغرام — خصوصية 100%، بدون تسجيل دخول',
    free: '✓ مجاني للأبد',
    noPassword: '✓ بدون كلمة مرور',
    privacy: '✓ 100% محلي',
  },
};

// React-element-like object syntax (required for non-Next.js Edge Functions)
// JSX only works in Next.js projects on Vercel
export default function handler(request: Request) {
  const { searchParams } = new URL(request.url);
  const langParam = searchParams.get('lang') || 'en';
  const lang = (SUPPORTED_LANGUAGES as readonly string[]).includes(langParam)
    ? (langParam as SupportedLanguage)
    : 'en';
  const t = translations[lang];
  const isRTL = RTL_LANGUAGES.includes(lang);

  const html = {
    type: 'div',
    key: null,
    props: {
      style: {
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0a0a0a',
        backgroundImage: 'linear-gradient(135deg, #1a1a2e 0%, #0a0a0a 100%)',
        direction: isRTL ? 'rtl' : 'ltr',
      },
      children: [
        // Shield icon container
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 120,
              height: 120,
              borderRadius: 32,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              marginBottom: 40,
            },
            children: {
              type: 'svg',
              props: {
                width: 64,
                height: 64,
                viewBox: '0 0 24 24',
                fill: 'none',
                stroke: 'white',
                strokeWidth: 2.5,
                children: [
                  {
                    type: 'path',
                    props: {
                      d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
                    },
                  },
                  {
                    type: 'path',
                    props: {
                      d: 'M9 12l2 2 4-4',
                    },
                  },
                ],
              },
            },
          },
        },
        // Title
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              fontSize: 64,
              fontWeight: 800,
              color: 'white',
              textAlign: 'center',
              marginBottom: 20,
            },
            children: 'Safe Unfollow',
          },
        },
        // Subtitle
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              fontSize: 28,
              color: '#a1a1aa',
              textAlign: 'center',
              maxWidth: 900,
              lineHeight: 1.4,
            },
            children: t.subtitle,
          },
        },
        // Trust badges
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              gap: 40,
              marginTop: 50,
              fontSize: 22,
              color: '#71717a',
            },
            children: [
              { type: 'span', props: { children: t.free } },
              { type: 'span', props: { children: t.noPassword } },
              { type: 'span', props: { children: t.privacy } },
            ],
          },
        },
      ],
    },
  };

  return new ImageResponse(html, {
    width: 1200,
    height: 630,
    headers: {
      'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000',
    },
  });
}
