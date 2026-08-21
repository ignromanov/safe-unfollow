# Design Handoff — Conversion Redesign Spec

> ⚠️ **SUPERSEDED IN PART by `03-answers-from-claude-design.md`** (2026-08-17), which answers
> `02-questions-for-claude-design.md`. Where they differ, the answers file wins. Corrected there:
> §0.1 (processor check is done — sessions arrive, loss is on the processor's page), §0.2 (neither
> counter is broken), P3 (detection and deep link already ship; FormatQuiz sits in the 39.7% step,
> so P2+P3 are one leak), P4 (CLS claim unproven both ways; rows are 92px, not 68px; no
> `font-display: optional`; ad frame is visual, not a CLS criterion), amber via `tone` not
> `severity`, 10 locales / 2 795 tests, named anchors instead of step numbers, and no rupiah line.

> **От**: дизайн-агент (SafeUnfollow Design System project) · 2026-08-17
> **Кому**: CTO-агент (спека и план) → локальный агент-исполнитель
> **Основание**: `design-conversion-brief.md` и `2026-08-17-conversion-funnel-measurement.md` (219 370 событий, 24.07–17.08). Мокапы: проект дизайн-системы, `templates/conversion-audit/` (ConversionAudit, FunnelEntry, ResultsMockup, PaywallCheckout).
> **Режим**: максимум конверсии в рамках конституции (trust budget, no dark patterns, privacy claims — только узкие истинные).

## 0. Предпосылки измеримости — ДО дизайн-правок

Без них эффект изменений неизмерим; порядок обязателен:

1. **Дашборд платёжного процессора**: сколько checkout-сессий создано с 08.08. Если 0 — чинить редирект кнопки, разговор о цене/копирайте преждевременен.
2. Мёртвые с 07.08 счётчики: `ad_slot_rendered`, `rescue_plan_impression` (component-level).
3. Поднять sampling `filter_toggle` с 3% до правок фильтров (наблюдаемые 9,4% — пол; модель даёт ~3 toggle/сессию).
4. Проверить обработчики `donation_card_click`/`dismiss` (1 061 показ / 0 кликов при ожидаемых ~4).
5. Добавить dimensions (locale, row_count, tier) на пейволл-события — сейчас их ноль.
6. Шесть событий с починенным 14.08 транспортом (sendBeacon → fetch) сравнивать только по окнам после 15.08; потеря была 45–50%.

## P1 · Вход в гайд (потеря −62–65% на шаге 1→2; шаги 2–8 держат 85–98%)

**Диагноз**: стена из 9 карточек читается как домашнее задание; на мобиле (87,5% сессий) это 6–7 экранов скролла до действия. Дело не в языке (id проходит лучше en: 36,1% vs 28,0%). Навигация немонотонна — люди ходят назад.

**Изменения** (мокап FunnelEntry §1B):
- Экран одного действия вместо грида: заголовок «Get your export from Instagram», честная цена времени («~2 min to request · Instagram emails the file in 5–30 min»), один primary CTA «Open Meta Accounts Center».
- Рецепт-карта из 5 настроек (Export to device · Only "Followers and following" · All time · **Format: JSON — not HTML** (amber-система) · Start export).
- Пошаговый режим с постерами — свёрнут в `<details>`/аккордеон, шаги по одному, свободная навигация назад/вперёд.
- Постоянная зона загрузки на том же экране: «Already got the email? Tap to choose your ZIP» + подсказка Downloads/Files.
- «Try with sample while you wait».
- Mobile: primary CTA дублируется sticky-низом (48px, w-full, safe-area-inset-bottom).

**Метрики**: wizard step 1→2 (5% sample — только шаг-к-шагу), CTA→upload_click (сейчас 39,7%).

## P2 · Hero: второй путь до файла (CTA→upload 39,7%)

**Изменение** (мокап §1A): «I already have my ZIP file» поднять из микро-ссылки до secondary-кнопки (border bg-card, иконка upload) сразу под primary CTA. **Больше ничего в above-the-fold не трогать** — поисковая конверсия лендинга измерена (8,44%) и работает.

## P3 · Ошибка формата: детекция вместо квиза (18,7% всех попыток; квиз решает 2,2%)

**Диагноз**: 79,8% отвечают «json», держа HTML — квиз спрашивает то, в чём человек уже ошибся. Парсер знает, что получил.

**Изменение** (мокап §1C): при HTML-детекте — amber-панель (не destructive): «Your file is the HTML export. Instagram's dialog defaults to HTML — it's one radio button. Re-run the export with Format: JSON (step 6).» + primary «Re-export as JSON — open step 6» (deep link на шаг 6 с постером) + secondary «Try another file». Аналогично ключевать остальные причины (too large 3,8%, not a ZIP 2,4%, not an IG export 1,7%). Квиз (`FormatQuiz`) удалить с критического пути.

**Метрики**: доля format-ошибок от parse starts; доля «fixed» после ошибки (сейчас 2,2%); recovery (сейчас 31,8%).

## P4 · /results CLS p75 = 1,00 (10× порога; фикс 6–7.08 не сработал)

**Дизайн-правило** (мокап ResultsMockup §2A): каждый асинхронный блок резервирует бокс:
- стат-карты — фиксированная высота, скелет той же геометрии;
- рекламный слот — постоянная рамка + подпись «Advertisement» независимо от заполнения (высота зарезервирована; формат-атрибуты не возвращать — намеренно);
- строки списка — 68px mobile / 60px desktop, скелет = те же боксы;
- шрифты — `font-display: optional`/preload, чтобы не двигали display-заголовки.
Найти фактический источник сдвига профайлером — фикс 6–7.08 измеримо не удержался; распределение бимодально (coin flip).

**Метрика**: web_vital CLS p75 на /results (mobile n≥40).

## P5 · Checkout: кнопка не подтверждает нажатие (0 из 6 покупок; 2/6 re-click через 1,0–1,3 с)

**Изменения** (мокап PaywallCheckout §3A):
- Состояния: idle → **мгновенно** disabled + спиннер «Opening secure checkout…» → note «You're being taken to the payment page. Your export stays in this browser.»
- Защита от повторного submit; таймаут с восстановлением и named-cause ошибкой.
- Пейволл value-first: «Your full list is ready — 8,930 rows. You already have the first 10 — free.» Сравнение фактом: «Similar trackers $5–10/month · This file $7 once». Цена — на пейволле, один раз (не на кнопке — закрытый вопрос).
- Mobile: bottom sheet (ручка, свайп, кнопка 48px w-full + safe-area); md+ — центрированный диалог.
- Гипотеза (feature-flag, выключено): подсказка «≈ Rp 115,000 · one-time» для id-локали — включать только после п.0.1.

## P6 · Индонезия (16,2% сессий; 26,2% аудитории пейволла; 3/6 checkout; upload success 80,9% vs 90,4%; ошибок 2,6×)

- Разобрать runtime-ошибки id-страниц (2,6× per pageview vs en) — до визуальных правок.
- Проверить гайд против индонезийского UI Meta (скриншоты сняты с en-интерфейса).
- iOS/Android-подсказки местоположения ZIP (roadmap v1.6) — приоритет №1 для id/in.

## Монетизация — чинить измерение, не множить поверхности

- Убрать рекламные юниты лендинга и гайда (viewability ≈ 0; меньше DOM и CLS). Density /results 26,4% из 30% — третьего юнита нет.
- Донат-карта: сначала п.0.4; текущая тихая подача соответствует trust-бюджету — не усиливать.
- Аффилиат: добавить impression-событие (22 клика ever, все на upload — место верное); без знаменателя CTR неизмерим.
- Rescue-план: не трогать (отключён, счётчик мёртв).

## Мобильный контракт (действует для всех правок)

44px min цели · 48px инпуты и primary `w-full sm:w-auto` · строки 68px mobile · `hidden sm:inline` вместо усечения · safe-area-inset-bottom на sticky-элементах · `flex-col sm:flex-row` · hover-эффекты сброшены под `@media (hover: none)` · motion под `prefers-reduced-motion` · RTL: логические свойства.

## Закрытые вопросы — не переоткрывать

Rescue-баннер (0,08% CTR) · второй ад-юнит лендинга (viewability 2,49%) · гео-блок рекламы в EU · укорачивание тайтлов · charm-pricing $6,99 · цена на кнопке экспорта · above-the-fold лендинга · контраст primary/accent (смержен 10.08, `c92f844`).

---

## Промпт для локального агента-исполнителя

```
Ты работаешь в репозитории ignromanov/safe-unfollow (ветка от main).
Прочитай целиком: .conclave/.claude/design-handoff-2026-08-17.md (этот файл),
.claude/constitution.md, .claude/product.md.

Задача: реализовать изменения P1–P5 сериями небольших PR, строго в этом порядке:

PR-0 (предпосылки, без UI): почини ad_slot_rendered и rescue_plan_impression;
подними sampling filter_toggle; проверь обработчики donation_card_click;
добавь dimensions (locale, row_count) к paywall_*/checkout_* событиям.
Отдельно (не код): проверь дашборд платёжного процессора — checkout-сессии с 08.08.

PR-1 (P5, самый дешёвый): состояния кнопки checkout в PaywallModal —
instant disabled + spinner "Opening secure checkout…", защита от double-submit,
таймаут с восстановлением. Тесты на состояния.

PR-2 (P3): в UploadZone/парсере ключуй ошибки от того, что нашёл парсер;
HTML-детект → amber-экран с deep link на шаг 6; убери FormatQuiz с критического пути.

PR-3 (P1+P2): новый вход в гайд — экран одного действия (см. спеку P1) с
рецепт-картой, свёрнутыми шагами, постоянной upload-зоной и sticky CTA на мобиле;
в Hero подними "I already have my ZIP" до secondary-кнопки. Above-the-fold
больше не менять. Сохрани SSG (160 маршрутов): никакого чтения URL при рендере.

PR-4 (P4): профилируй источник CLS на /results; примени правило резервирования
боксов (фиксированные высоты стат-карт/строк/ад-слота, скелеты той же геометрии,
font-display). Цель: CLS p75 < 0.1 на mobile.

Инварианты для каждого PR: mobile-first (контракт в спеке), WCAG AA, RTL через
логические свойства, i18n — все 11 локалей (новые строки во все locale-файлы),
не нарушай src/__tests__/docs/monetization-claims.test.ts (никаких "free forever",
"no ads"; узкая истина: "the analysis is free", "the export never leaves the browser"),
не переоткрывай закрытые вопросы из раздела спеки. 1 601 тест должен остаться зелёным;
на каждое поведенческое изменение — тест. Референсы визуала — мокапы
templates/conversion-audit/* в дизайн-проекте.
```
