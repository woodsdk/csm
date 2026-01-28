# People's Doctor Design System

## Oversigt

Dette design system definerer den visuelle identitet for People's Doctor platformen.

**Hovedfil:** `platform.css` - Indeholder alle styles til platformens views.

**Bemærk:** `platform-preview.html` har inline styles og bruger ikke platform.css direkte.

---

## Farver

### Navy Skala (Brand)

| CSS Variable | Hex | Anvendelse |
|--------------|-----|------------|
| `--color-navy-900` | `#13102C` | Primær tekst, logo "PEOPLE'S" |
| `--color-navy-800` | `#26304F` | Sekundære elementer |
| `--color-navy-700` | `#323E63` | Tertiære elementer |
| `--color-navy-600` | `#38456D` | Gradient start, hover states |
| `--color-navy-500` | `#5669A4` | Links, ikoner, logo "DOCTOR" |
| `--color-navy-400` | `#A3B0D9` | Muted tekst, placeholders |

### Semantiske Farver

| CSS Variable | Værdi | Anvendelse |
|--------------|-------|------------|
| `--color-text` | `#13102C` | Al primær tekst |
| `--color-text-inverse` | `#FFFFFF` | Tekst på mørk baggrund |
| `--color-text-muted` | `rgba(0, 0, 0, 0.3)` | Placeholders |
| `--color-icon` | `#2E395A` | Standard ikon farve |
| `--color-success` | `#22C55E` | Success states |
| `--color-warning` | `#F59E0B` | Warning states |
| `--color-error` | `#EF4444` | Error/danger states |
| `--color-accent` | `#EC4899` | Accent/highlight (pink) |

### Specielle Farver

| Værdi | Hex | Anvendelse |
|-------|-----|------------|
| Recording Red | `#DC2626` | Aktiv optagelse cirkel |
| Danger Light BG | `#FEF2F2` | Danger knap hover baggrund |
| Danger Border | `#FECACA` | Danger knap hover border |

### Neutrale Farver

| CSS Variable | Hex | Anvendelse |
|--------------|-----|------------|
| `--color-gray-200` | `#EBEBF3` | Borders, dividers |
| `--color-gray-100` | `#F8F8FD` | Subtle baggrunde, hover |
| `--color-white` | `#FFFFFF` | Cards, hovedbaggrund |

### Gradienter

```css
--gradient-page-bg: linear-gradient(135deg, #EBEBF4 0%, #FFFFFF 100%);
--gradient-button-primary: linear-gradient(135deg, #38456D 0%, #5669A4 100%);
```

---

## Typografi

### Font

```css
--font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
```

### Størrelser

| Token | Størrelse | Anvendelse |
|-------|-----------|------------|
| `--font-size-xs` | 10px | Meget små labels |
| `--font-size-sm` | 12px | Badges, små labels |
| `--font-size-base` | 13px | Standard body tekst |
| `--font-size-md` | 14px | Inputs, knapper |
| `--font-size-lg` | 15px | Større body tekst |
| `--font-size-xl` | 16px | Underoverskrifter |
| `--font-size-2xl` | 18px | Sektionstitler |
| `--font-size-3xl` | 20px | Store titler |
| `--font-size-4xl` | 26px | Sidetitler |

---

## Spacing

| Token | Værdi | Anvendelse |
|-------|-------|------------|
| `--spacing-content` | 50px | Hoved content padding |
| `--spacing-content-gap` | 50px | Gap mellem hovedområder |
| `--spacing-content-top` | 40px | Top padding |
| `--spacing-section-gap` | 20px | Gap mellem sektioner |
| `--spacing-card-padding` | 25px | Intern card padding |

---

## Border Radius

| Token | Værdi | Anvendelse |
|-------|-------|------------|
| `--radius-sm` | 4px | Små elementer |
| `--radius-md` | 8px | Inputs, små cards |
| `--radius-lg` | 12px | Cards, dropdowns |
| `--radius-xl` | 16px | Store cards |
| `--radius-2xl` | 20px | Hovedcards |
| `--radius-full` | 9999px | Runde knapper, badges, avatars |

---

## Shadows

| Token | Anvendelse |
|-------|------------|
| `--shadow-card` | Cards (`0 0 25px rgba(38, 48, 79, 0.05)`) |
| `--shadow-topbar` | Top navigation (`0 2px 10px rgba(0, 0, 0, 0.08)`) |
| `--shadow-button` | Primære knapper (`0 4px 15px rgba(56, 69, 109, 0.2)`) |
| `--shadow-button-hover` | Knapper hover (`0 8px 20px rgba(56, 69, 109, 0.25)`) |
| `--shadow-nav-secondary` | Sekundær navigation |
| `--shadow-nav-secondary-hover` | Sekundær navigation hover |
| `--shadow-bottom-nav` | Mobil bundnavigation |

---

## Transitions

```css
--transition-fast: 0.2s ease;      /* Hurtig UI feedback */
--transition-normal: 0.3s ease;    /* Standard state changes */
--transition-smooth: 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94); /* Komplekse animationer */
```

---

## Layout Dimensioner

| Token | Værdi | Beskrivelse |
|-------|-------|-------------|
| `--topbar-height` | 64px | Desktop top bar højde |
| `--topbar-height-mobile` | 56px | Mobil top bar højde |
| `--sidebar-width` | 260px | Sidebar bredde |
| `--bottom-nav-height` | 70px | Mobil bundnavigation højde |

### Breakpoints

| Navn | Bredde | Layout |
|------|--------|--------|
| Desktop | > 1280px | Fuld sidebar + hovedindhold |
| Tablet | 1024px - 1280px | Reduceret spacing |
| Small Tablet | < 1024px | Bundnavigation, stacked layout |
| Mobile | < 768px | Kompakt layout |
| Small Mobile | < 480px | Minimal spacing |

---

## Komponenter

### Layout

| Klasse | Beskrivelse |
|--------|-------------|
| `.platform` | Rod-container, 100vh flex column |
| `.topbar` | Top navigation bar |
| `.content-area` | Hovedindhold wrapper (sidebar + main) |
| `.sidebar` | Venstre navigation panel |
| `.main` | Hovedindholdsområde |
| `.bottom-nav` | Mobil bundnavigation (vises < 1024px) |

### Top Bar

| Klasse | Beskrivelse |
|--------|-------------|
| `.topbar__logo` | Logo container |
| `.logo-text--people` | "PEOPLE'S" tekst (navy-900) |
| `.logo-text--doctor` | "DOCTOR" tekst (navy-500) |
| `.topbar__right` | Højre side elementer |
| `.clinic-dropdown` | Klinik vælger dropdown |
| `.flags` | Sprogflag container |
| `.flag--dk` | Dansk flag |
| `.flag--uk` | UK flag |
| `.user-menu` | Bruger menu med dropdown |
| `.user-avatar` | Bruger avatar cirkel |
| `.user-name` | Bruger navn |
| `.user-dropdown` | Dropdown menu (kræver `.user-menu--open`) |
| `.user-dropdown__item` | Dropdown menu item |
| `.user-dropdown__divider` | Separator linje |

### Sidebar Navigation

| Klasse | Beskrivelse |
|--------|-------------|
| `.sidebar__nav` | Navigation knapper container |
| `.nav-btn` | Base navigation knap |
| `.nav-btn--primary` | Primær knap (gradient baggrund) |
| `.nav-btn--secondary` | Sekundær knap (hvid baggrund) |
| `.nav-btn--active` | Aktiv state for sekundære knapper |
| `.sidebar__bottom-box` | Bund links boks |
| `.bottom-link` | Link i bund boksen |

### Cards

| Klasse | Beskrivelse |
|--------|-------------|
| `.card` | Base card styling |
| `.card__title` | Card overskrift |
| `.card__content` | Card indhold wrapper |
| `.card--full` | Full width card |
| `.card--no-padding` | Card uden padding |
| `.card--split` | To-kolonne card layout |
| `.card__sidebar` | Venstre kolonne i split card |
| `.card__main` | Højre kolonne i split card |

### Formularer

| Klasse | Beskrivelse |
|--------|-------------|
| `.form-group` | Form felt wrapper |
| `.form-label` | Label styling |
| `.form-row` | Flere felter på en række |
| `.form-input` | Text input |
| `.form-input--short` | Kort input (50% bredde) |
| `.form-textarea` | Textarea |
| `.form-select` | Select dropdown |
| `.file-upload` | Fil upload område |
| `.file-upload__text` | Upload tekst |
| `.file-upload__hint` | Upload hint |

### Knapper

| Klasse | Beskrivelse |
|--------|-------------|
| `.btn-primary` | Primær gradient knap |
| `.btn-secondary` | Outlined sekundær knap |
| `.btn-danger` | Rød danger knap |
| `.btn-icon` | Kun ikon knap (cirkel) |
| `.action-btn` | Lille tabel action knap |
| `.action-btn--primary` | Primær action |
| `.action-btn--secondary` | Sekundær action |
| `.action-btn--danger` | Slet action (rød) |

### Tabeller

| Klasse | Beskrivelse |
|--------|-------------|
| `.table` | Base tabel styling |
| `.table--history` | Udvidet tabel med hover effekt |
| `.table-actions` | Container til action knapper |
| `.table-btn` | Tabel knap base |
| `.table-btn--outline` | Outlined tabel knap |
| `.table-btn--link` | Text-only tabel knap |
| `.warning-icon` | Advarsel ikon (orange) |

### Søgning

| Klasse | Beskrivelse |
|--------|-------------|
| `.search-box` | Søgefelt med ikon til højre |
| `.search-input-wrapper` | Søgefelt med ikon til venstre |
| `.search-input` | Input i search-input-wrapper |

### Indstillinger

| Klasse | Beskrivelse |
|--------|-------------|
| `.settings-section` | Indstillingsgruppe card |
| `.settings-section__title` | Sektionsoverskrift |
| `.settings-row` | Enkelt indstilling række |
| `.settings-row__label` | Label del af rækken |
| `.settings-row__title` | Indstillingsnavn |
| `.settings-row__description` | Beskrivelse |
| `.toggle` | Toggle switch container |
| `.toggle__input` | Hidden checkbox |
| `.toggle__slider` | Toggle visuel slider |
| `.settings-input` | Input i indstillinger |
| `.settings-input--wide` | Bred input |
| `.settings-select` | Select i indstillinger |

### Beskeder

| Klasse | Beskrivelse |
|--------|-------------|
| `.message-list` | Besked liste container |
| `.message-item` | Enkelt besked række |
| `.message-item--unread` | Ulæst besked styling |
| `.message-item__avatar` | Afsender avatar |
| `.message-item__content` | Besked indhold |
| `.message-item__sender` | Afsender navn |
| `.message-item__time` | Tidsstempel |
| `.message-item__subject` | Emne linje |
| `.message-item__preview` | Preview tekst |
| `.message-badge` | Ulæst tæller badge |
| `.message-detail` | Fuld besked visning |
| `.message-compose` | Svar textarea område |

### Tabs

| Klasse | Beskrivelse |
|--------|-------------|
| `.tabs` | Tab navigation container |
| `.tab` | Enkelt tab knap |
| `.tab--active` | Aktiv tab state |

### Admin / Brugerliste

| Klasse | Beskrivelse |
|--------|-------------|
| `.admin-list` | Brugerliste container |
| `.admin-list-item` | Bruger række |
| `.admin-list-item__info` | Avatar + info del |
| `.admin-list-item__avatar` | Bruger avatar |
| `.admin-list-item__details` | Navn + email |
| `.admin-list-item__name` | Bruger navn |
| `.admin-list-item__meta` | Email/meta info |
| `.admin-list-item__actions` | Action knapper |
| `.stats-grid` | Grid til stat cards (4 kolonner) |
| `.stat-card` | Statistik card |
| `.stat-card__value` | Stor værdi |
| `.stat-card__label` | Label under værdi |

### Badges

| Klasse | Beskrivelse |
|--------|-------------|
| `.badge` | Base badge styling |
| `.badge--admin` | Admin rolle (mørk) |
| `.badge--user` | Bruger rolle (grå) |
| `.badge--active` | Aktiv status (grøn) |
| `.badge--inactive` | Inaktiv status (rød) |

### Compliance/Content Sider

| Klasse | Beskrivelse |
|--------|-------------|
| `.compliance-content` | Indhold wrapper |
| `.compliance-section` | Indholdssektion |
| `.compliance-section__title` | Sektionsoverskrift |
| `.compliance-section__text` | Brødtekst |
| `.compliance-list` | Checkliste |
| `.compliance-list__item` | Liste item med ikon |
| `.compliance-list__icon` | Ikon (venstre) |
| `.compliance-list__text` | Tekst (højre) |
| `.highlight-box` | Fremhævet info boks |
| `.highlight-box__title` | Boks titel |
| `.highlight-box__text` | Boks tekst |

### Sektionsheader

| Klasse | Beskrivelse |
|--------|-------------|
| `.section-header` | Header med titel + actions |
| `.section-header__title` | Sektions titel |
| `.page-header` | Side header (bruges i main) |
| `.page-header__title` | Side titel |
| `.page-header__subtitle` | Side undertekst |

### Support / AI Cards

| Klasse | Beskrivelse |
|--------|-------------|
| `.support-card` | Support info card |
| `.support-avatars` | Avatar stack |
| `.support-avatar` | Enkelt support avatar |
| `.support-badge` | Online/status badge |
| `.support-title` | Support titel |
| `.support-phone` | Telefon nummer |
| `.support-email` | Email link |
| `.ai-card` | AI assistent card |
| `.ai-card__title` | AI card titel |
| `.ai-suggestions` | Forslag chips container |
| `.ai-suggestion` | Enkelt forslag chip |
| `.ai-input-wrapper` | AI input container |
| `.ai-input` | AI tekst input |
| `.ai-btn` | AI knap |
| `.ai-btn--send` | Send knap (primær) |

### Empty States

| Klasse | Beskrivelse |
|--------|-------------|
| `.empty-state` | Tom tilstand container |
| `.empty-state__icon` | Ikon |
| `.empty-state__title` | Titel |
| `.empty-state__description` | Beskrivelse |

### Utility Classes

| Klasse | Beskrivelse |
|--------|-------------|
| `.visually-hidden` | Kun synlig for screen readers |
| `.text-center` | Center tekst |
| `.text-right` | Højrestil tekst |
| `.mt-auto` | margin-top: auto |
| `.mb-0` | margin-bottom: 0 |

---

## Fil Struktur

```
Frontend Design/
├── platform.css              # HOVED STYLESHEET - alle platform styles
├── DESIGN-GUIDE.md           # Denne dokumentation
├── design-guide.html         # Visuel design guide (bruger platform.css)
├── platform-preview.html     # Start konsultation view
├── konsultation-aktiv.html   # Aktiv konsultation view
├── konsultationshistorik.html
├── journalresume.html
├── honorarforslag.html
├── indstillinger.html
├── beskeder.html
├── admin-indstillinger.html
└── sikkerhed-compliance.html
```

**Bemærk:** `design-guide.html` importerer `platform.css` og tilføjer kun guide-specifikke styles inline.

---

## Brug

### HTML Import

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="platform.css">
<script src="https://unpkg.com/lucide@latest"></script>
```

### Ikoner (Lucide)

```html
<i data-lucide="play"></i>
<i data-lucide="history"></i>
<i data-lucide="file-text"></i>
<!-- ... -->

<script>
  lucide.createIcons();
</script>
```

### Standard Ikon Mapping

**VIGTIGT:** Brug altid disse ikoner for konsistens på tværs af views:

| Funktion | Lucide Ikon | Bemærkning |
|----------|-------------|------------|
| Start Konsultation | `play` | |
| Konsultationshistorik | `history` | |
| Journalresume | `file-text` | |
| Honorarforslag | `receipt` | |
| Admin | `settings-2` | IKKE `settings` |
| Beskeder | `message-square` | |
| Indstillinger | `sliders` | IKKE `sliders-horizontal` |
| Sikkerhed & Compliance | `shield` | IKKE `shield-check` |
| Log ud | `log-out` | |
| Søg | `search` | |
| Rediger | `pencil` | |
| Slet | `trash-2` | |
| Success | `check-circle` | Farve: `--color-success` |
| Advarsel | `alert-triangle` | Farve: `--color-warning` |
| Fejl | `x-circle` | Farve: `#EF4444` |
| Mikrofon | `mic` / `mic-off` | |
| Pause | `pause` | |
| Stop | `square` | |

### CSS Variables

```css
.my-component {
  color: var(--color-text);
  background: var(--color-white);
  border-radius: var(--radius-lg);
  padding: var(--spacing-card-padding);
  box-shadow: var(--shadow-card);
  transition: all var(--transition-fast);
}
```

---

## Brand

### Logo

- **"PEOPLE'S"**: Inter Bold, uppercase, `#13102C` (navy-900)
- **"DOCTOR"**: Inter Bold, uppercase, `#5669A4` (navy-500)
- Afstand mellem ord: 4px

### Flag Ikoner

- Dansk (DK) og UK flag
- Størrelse: 24px cirkulære
- Hover: scale(1.1)

---

## Animationer

### Page Load (fadeUp)

```css
@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

Respekterer `prefers-reduced-motion` præference.
