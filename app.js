const { useMemo, useState } = React;
const { createRoot } = ReactDOM;

const CONTACTS = [{ id: "shira-mizrahi", name: "שירה מזרחי" }];
const TODAY = new Date().toISOString().slice(0, 10);
const VALID_UNTIL = addDays(new Date(), 30).toISOString().slice(0, 10);

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function makeId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function newWorkGroup() {
  return {
    id: makeId("group"),
    name: "עובדת ניקיון",
    workers: 1,
    hourly_wage: 39.11,
    days_per_week: 5,
    hours_per_day: 6,
    overtime_hours_per_day: 0,
    is_shabbat: false,
  };
}

function newSite() {
  return {
    id: makeId("site"),
    name: "אתר חדש",
    km_one_direction: 8,
    trips_per_shift: 1,
    driver_bonus_per_shift: 0,
    contact_people: [],
    work_groups: [newWorkGroup()],
  };
}

function initialForm() {
  return {
    clientName: "",
    quoteDate: TODAY,
    validUntil: VALID_UNTIL,
    contactId: CONTACTS[0].id,
    margin: 0.15,
    sites: [newSite()],
  };
}

function money(value) {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function wholeMoney(value) {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function hours(value) {
  return new Intl.NumberFormat("he-IL", {
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("he-IL").format(date);
}

function numberFromInput(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function App() {
  const [form, setForm] = useState(initialForm);

  const quote = useMemo(() => {
    const selectedContact = CONTACTS.find((contact) => contact.id === form.contactId);

    const input = {
      margin: form.margin,
      client: {
        id: "client-current",
        name: form.clientName.trim() || "לקוח חדש",
        contact_people: selectedContact ? [selectedContact] : [],
        sites: form.sites,
      },
    };

    try {
      return { result: window.PricingEngine.calculateQuote(input), error: null };
    } catch (error) {
      return { result: null, error: error.message };
    }
  }, [form]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateSite(siteId, field, value) {
    setForm((current) => ({
      ...current,
      sites: current.sites.map((site) => (site.id === siteId ? { ...site, [field]: value } : site)),
    }));
  }

  function updateWorkGroup(siteId, groupId, field, value) {
    setForm((current) => ({
      ...current,
      sites: current.sites.map((site) => {
        if (site.id !== siteId) return site;

        return {
          ...site,
          work_groups: site.work_groups.map((group) =>
            group.id === groupId ? { ...group, [field]: value } : group
          ),
        };
      }),
    }));
  }

  function addSite() {
    setForm((current) => ({ ...current, sites: [...current.sites, newSite()] }));
  }

  function removeSite(siteId) {
    setForm((current) => ({
      ...current,
      sites: current.sites.length === 1 ? current.sites : current.sites.filter((site) => site.id !== siteId),
    }));
  }

  function addWorkGroup(siteId) {
    setForm((current) => ({
      ...current,
      sites: current.sites.map((site) =>
        site.id === siteId ? { ...site, work_groups: [...site.work_groups, newWorkGroup()] } : site
      ),
    }));
  }

  function removeWorkGroup(siteId, groupId) {
    setForm((current) => ({
      ...current,
      sites: current.sites.map((site) => {
        if (site.id !== siteId || site.work_groups.length === 1) return site;
        return { ...site, work_groups: site.work_groups.filter((group) => group.id !== groupId) };
      }),
    }));
  }

  return h("div", { className: "app" }, [
    h("header", { className: "topbar" }, [
      h("h1", null, "מערכת תמחור שירותי ניקיון"),
      h("p", null, "הצעת מחיר דינמית לפי אתרים, צוותי עבודה ושעות בפועל"),
    ]),
    h("main", { className: "layout" }, [
      h("section", { className: "panel" }, [
        h("h2", { className: "section-title" }, "פרטי לקוח"),
        h("div", { className: "grid" }, [
          h(Field, {
            label: "שם לקוח",
            value: form.clientName,
            onChange: (value) => updateForm("clientName", value),
            placeholder: "לדוגמה: בית החולים הסקוטי",
          }),
          h(DateField, {
            label: "תאריך",
            value: form.quoteDate,
            onChange: (value) => updateForm("quoteDate", value),
          }),
          h(DateField, {
            label: "בתוקף עד",
            value: form.validUntil,
            onChange: (value) => updateForm("validUntil", value),
          }),
          h(SelectField, {
            label: "אשת קשר",
            value: form.contactId,
            onChange: (value) => updateForm("contactId", value),
            options: CONTACTS.map((contact) => ({ value: contact.id, label: contact.name })),
          }),
          h(NumberField, {
            label: "רווח",
            value: form.margin,
            min: 0.1,
            max: 0.15,
            step: 0.005,
            onChange: (value) => updateForm("margin", clamp(value, 0.1, 0.15)),
          }),
        ]),
        h("div", { className: "row-actions", style: { marginTop: 22 } }, [
          h("h2", { className: "section-title", style: { margin: 0 } }, "אתרים"),
          h("button", { className: "button primary", type: "button", onClick: addSite }, "הוספת אתר"),
        ]),
        form.sites.map((site, index) =>
          h(SiteForm, {
            key: site.id,
            site,
            index,
            canRemove: form.sites.length > 1,
            onChange: updateSite,
            onRemove: removeSite,
            onGroupChange: updateWorkGroup,
            onAddGroup: addWorkGroup,
            onRemoveGroup: removeWorkGroup,
          })
        ),
      ]),
      h(Summary, { quote }),
    ]),
    h(ProposalPreview, { form, quote }),
  ]);
}

function SiteForm(props) {
  const { site, index, canRemove, onChange, onRemove, onGroupChange, onAddGroup, onRemoveGroup } = props;

  return h("div", { className: "site" }, [
    h("div", { className: "site-header" }, [
      h("h3", null, `אתר ${index + 1}`),
      h(
        "button",
        { className: "button danger", type: "button", onClick: () => onRemove(site.id), disabled: !canRemove },
        "הסרת אתר"
      ),
    ]),
    h("div", { className: "grid", style: { marginTop: 12 } }, [
      h(Field, {
        label: "שם האתר",
        value: site.name,
        onChange: (value) => onChange(site.id, "name", value),
      }),
      h(NumberField, {
        label: "ק״מ לכיוון אחד",
        value: site.km_one_direction,
        min: 0,
        step: 1,
        onChange: (value) => onChange(site.id, "km_one_direction", Math.max(0, value)),
      }),
      h(NumberField, {
        label: "נסיעות למשמרת",
        value: site.trips_per_shift,
        min: 0,
        step: 0.5,
        onChange: (value) => onChange(site.id, "trips_per_shift", Math.max(0, value)),
      }),
      h(NumberField, {
        label: "בונוס מסיעה יומי",
        value: site.driver_bonus_per_shift || 0,
        min: 0,
        step: 0.5,
        onChange: (value) => onChange(site.id, "driver_bonus_per_shift", Math.max(0, value)),
      }),
    ]),
    h("div", { className: "work-groups" }, [
      h("div", { className: "row-actions" }, [
        h("h3", { className: "section-title", style: { margin: 0 } }, "קבוצות עבודה"),
        h("button", { className: "button", type: "button", onClick: () => onAddGroup(site.id) }, "הוספת קבוצה"),
      ]),
      site.work_groups.map((group, groupIndex) =>
        h(WorkGroupForm, {
          key: group.id,
          site,
          group,
          index: groupIndex,
          canRemove: site.work_groups.length > 1,
          onChange: onGroupChange,
          onRemove: onRemoveGroup,
        })
      ),
    ]),
  ]);
}

function WorkGroupForm({ site, group, index, canRemove, onChange, onRemove }) {
  const maxOvertime = Math.max(0, 12 - group.hours_per_day);

  return h("div", { className: "work-group" }, [
    h("div", { className: "group-header" }, [
      h("h4", null, `קבוצה ${index + 1}`),
      h(
        "button",
        { className: "button danger", type: "button", onClick: () => onRemove(site.id, group.id), disabled: !canRemove },
        "הסרת קבוצה"
      ),
    ]),
    h("div", { className: "group-grid" }, [
      h(Field, {
        label: "שם תפקיד",
        value: group.name,
        onChange: (value) => onChange(site.id, group.id, "name", value),
      }),
      h(NumberField, {
        label: "עובדות",
        value: group.workers,
        min: 1,
        step: 1,
        onChange: (value) => onChange(site.id, group.id, "workers", Math.max(1, Math.round(value))),
      }),
      h(NumberField, {
        label: "שכר שעתי",
        value: group.hourly_wage,
        min: 0,
        step: 1,
        onChange: (value) => onChange(site.id, group.id, "hourly_wage", Math.max(0, value)),
      }),
      h(NumberField, {
        label: "ימים בשבוע",
        value: group.days_per_week,
        min: 1,
        max: 7,
        step: 1,
        onChange: (value) => onChange(site.id, group.id, "days_per_week", clamp(Math.round(value), 1, 7)),
      }),
      h(NumberField, {
        label: "שעות ביום",
        value: group.hours_per_day,
        min: 0.25,
        max: 12,
        step: 0.25,
        onChange: (value) => {
          const hours = clamp(value, 0.25, 12);
          onChange(site.id, group.id, "hours_per_day", hours);
          onChange(site.id, group.id, "overtime_hours_per_day", Math.min(group.overtime_hours_per_day, 12 - hours));
        },
      }),
      h(NumberField, {
        label: "שעות נוספות",
        value: group.overtime_hours_per_day,
        min: 0,
        max: maxOvertime,
        step: 0.25,
        onChange: (value) => onChange(site.id, group.id, "overtime_hours_per_day", clamp(value, 0, maxOvertime)),
      }),
      h("label", { className: "field" }, [
        h("span", null, "שבת"),
        h("span", { className: "switch" }, [
          h("input", {
            type: "checkbox",
            checked: group.is_shabbat,
            onChange: (event) => onChange(site.id, group.id, "is_shabbat", event.target.checked),
          }),
          h("span", null, group.is_shabbat ? "כן" : "לא"),
        ]),
      ]),
    ]),
  ]);
}

function Summary({ quote }) {
  const result = quote.result;

  return h("aside", { className: "summary" }, [
    h("div", { className: "summary-header" }, [
      h("h2", null, "סיכום הצעה"),
      h("p", null, "החישוב מתעדכן בזמן אמת"),
    ]),
    h("div", { className: "summary-body" }, [
      quote.error ? h("div", { className: "error" }, quote.error) : null,
      result
        ? [
            h(Metric, { label: "עלות שעתית", value: money(result.hourly_cost) }),
            h(Metric, { label: "מחיר שעתי ללקוח", value: money(result.final_price) }),
            h(Metric, { label: "שעות חודשיות", value: hours(result.monthly_hours) }),
            h(Metric, { label: "עלות חודשית", value: money(result.monthly_cost) }),
            h(Metric, { label: "רווח תפעולי חודשי", value: money(result.profit) }),
            h(Metric, { label: "מחיר חודשי", value: money(result.monthly_price) }),
            result.sites.map((site) =>
              h("div", { className: "site-summary", key: site.site.id }, [
                h("h3", null, site.site.name),
                h(Metric, { label: "מחיר שעתי", value: money(site.final_price) }),
                h(Metric, { label: "שעות חודשיות", value: hours(site.monthly_hours) }),
              ])
            ),
          ]
        : null,
    ]),
  ]);
}

function Metric({ label, value }) {
  return h("div", { className: "metric" }, [h("span", null, label), h("strong", null, value)]);
}

function ProposalPreview({ form, quote }) {
  const result = quote.result;

  return h("section", { className: "proposal-section" }, [
    h("div", { className: "proposal-toolbar" }, [
      h("div", null, [
        h("h2", null, "הצעת מחיר מוכנה"),
        h("p", null, "תצוגה על דף ממותג עם לוגו, מוכנה להדפסה או שמירה כ-PDF"),
      ]),
      h("button", { className: "button primary", type: "button", onClick: () => window.print() }, "הדפסה / שמירה כ-PDF"),
    ]),
    quote.error ? h("div", { className: "error" }, quote.error) : null,
    result ? h("div", { className: "proposal-paper" }, [
      h(ProposalIntroPage, { form }),
      h(ProposalPricingPage, { result }),
      h(ProposalTermsPage, null),
    ]) : null,
  ]);
}

function ProposalPage({ children }) {
  return h("article", { className: "proposal-page" }, [
    h("img", { className: "proposal-logo", src: "image1.png", alt: "לוגו קואופרטיב אמל" }),
    h("div", { className: "proposal-content" }, children),
    h(ProposalFooter),
  ]);
}

function ProposalFooter() {
  return h("footer", { className: "proposal-footer" }, [
    "קואופרטיב ניקיון תנז׳יף - אגודה שיתופית לשירותים בע״מ | טלפון 050-5731830 | פקס 077-444-8994",
    h("br"),
    "HaNikayonCoop@gmail.com | גבעת חביבה, ד.נ מנשה, 3785000",
  ]);
}

function ProposalIntroPage({ form }) {
  const clientName = form.clientName.trim() || "לקוח חדש";

  return h(ProposalPage, null, [
      h("div", { className: "proposal-date" }, formatDate(form.quoteDate)),
      h("p", null, "לכבוד"),
      h("p", { className: "proposal-client" }, clientName),
      h("h2", { className: "proposal-title" }, "הצעת מחיר עבור שירותי ניקיון"),
      proposalIntroParagraphs().map((text, index) => h("p", { key: index }, text)),
      h("p", { className: "proposal-signature" }, "בברכה,"),
      h("p", { className: "proposal-signature" }, "קואופרטיב אמל"),
    ]);
}

function ProposalPricingPage({ result }) {
  const cost = proposalCostBreakdown(result);
  const groups = proposalWorkforceRows(result);
  const showSites = result.sites.length > 1;

  return h(ProposalPage, null, [
      h("h2", { className: "proposal-title" }, "מפרט ניקיון שוטף - הצעת מחיר ראשונית"),
      h("table", { className: "proposal-table cost-table" }, [
        h("thead", null, h("tr", null, [
          h("th", null, "פירוט"),
          h("th", null, "מרכיבי העלות"),
          h("th", null, "מרכיבי העלות"),
        ])),
        h("tbody", null, [
          h("tr", null, [
            h("td", null, "עלות לשעת ניקיון"),
            h("td", null, cost.map((row) => h("div", { key: row.label }, row.label))),
            h("td", null, cost.map((row) => h("div", { key: row.label }, money(row.hourly)))),
          ]),
          h("tr", { className: "total-row" }, [
            h("td", { colSpan: 2 }, "סה״כ עלות שעתית לפני מע״מ"),
            h("td", null, wholeMoney(result.final_price)),
          ]),
        ]),
      ]),
      h("h3", { className: "proposal-subtitle" }, "כוח אדם והיקף עבודה"),
      h("table", { className: "proposal-table" }, [
        h("thead", null, h("tr", null, [
          showSites ? h("th", null, "אתר") : null,
          h("th", null, "תפקיד"),
          h("th", null, "עובדות"),
          h("th", null, "שעות"),
          h("th", null, "תעריף שעתי"),
          h("th", null, "אומדן חודשי"),
        ].filter(Boolean))),
        h("tbody", null, groups.map((row, index) => h("tr", { key: index }, [
          showSites ? h("td", null, row.siteName) : null,
          h("td", null, row.role),
          h("td", null, hours(row.workers)),
          h("td", null, row.hoursText),
          h("td", null, wholeMoney(row.hourlyRate)),
          h("td", null, money(row.monthlyPrice)),
        ].filter(Boolean)))),
      ]),
      h("div", { className: "proposal-total" }, [
        h("span", null, "סה״כ אומדן חודשי"),
        h("strong", null, money(result.monthly_price)),
      ]),
    ]);
}

function ProposalTermsPage() {
  return h(ProposalPage, null, [
      h("h2", { className: "proposal-title" }, "תנאים והבהרות"),
      h("ul", { className: "proposal-terms" }, proposalTermsParagraphs().map((text, index) => h("li", { key: index }, text))),
      h("h3", { className: "proposal-subtitle" }, "פרטי קשר"),
      h("p", null, "שירה מזרחי | 050-5731830 | HaNikayonCoop@gmail.com"),
    ]);
}

function proposalIntroParagraphs() {
  return [
    "בהמשך לשיחתנו אנו מודות לך על האפשרות להגיש הצעה לשירותי ניקיון.",
    "קואופרטיב אמל הוא עסק חברתי בבעלות עובדות הניקיון עצמן, שקם במטרה להיות אלטרנטיבה הוגנת לחברות הקבלן.",
    "העובדות מקבלות ליווי, הכשרות ותנאי העסקה הוגנים, לצד פיקוח מקצועי ושמירה על איכות השירות.",
    "נשמח לספק עבורכם שירותי ניקיון מקצועיים, יציבים ושקופים.",
  ];
}

function proposalTermsParagraphs() {
  return [
    "חשבון החיוב החודשי נעשה בהתאם לדיווח השעות בפועל.",
    "מסגרת השעות גמישה וניתנת לעדכון לפי הצרכים בשטח ובתיאום עם הלקוח.",
    "העלות השעתית כוללת את כלל רכיבי השכר, הנסיעות, התקורה והרווח התפעולי.",
    "רכש ואספקת חומרי ניקיון יבוצעו על ידי הלקוח, אלא אם סוכם אחרת.",
    "ההצעה אינה כוללת מע״מ.",
  ];
}

function proposalCostBreakdown(result) {
  const monthlyHours = result.monthly_hours || 1;
  const totals = result.sites.reduce((sum, site) => {
    site.work_groups.forEach((group) => {
      sum.salary += group.breakdown.salary.monthly_regular_salary_cost || 0;
      sum.overtime += group.breakdown.overtime.monthly_overtime_cost || 0;
      sum.travel += (group.breakdown.travel.monthly_travel_cost || 0) + (group.breakdown.travel.monthly_driver_bonus_cost || 0);
      sum.travelSocial += group.breakdown.travel.monthly_travel_social_cost || 0;
    });
    return sum;
  }, { salary: 0, overtime: 0, travel: 0, travelSocial: 0 });

  return [
    { label: "שכר ועלויות מעביד", hourly: (totals.salary + totals.overtime) / monthlyHours },
    { label: "נסיעות", hourly: totals.travel / monthlyHours },
    { label: "סוציאליות על נסיעות 5%", hourly: totals.travelSocial / monthlyHours },
    { label: "תקורה תפעולית ורווח", hourly: result.profit / monthlyHours },
  ];
}

function proposalWorkforceRows(result) {
  return result.sites.flatMap((site) =>
    site.work_groups.map((group) => ({
      siteName: site.site.name,
      role: group.work_group.name,
      workers: group.work_group.workers,
      hoursText: `${hours(group.work_group.days_per_week)} ימים בשבוע, ${hours(group.work_group.hours_per_day)} שעות ביום`,
      hourlyRate: group.final_price,
      monthlyPrice: group.monthly_price,
    }))
  );
}

function Field({ label, value, onChange, placeholder, readOnly }) {
  return h("label", { className: "field" }, [
    h("span", null, label),
    h("input", {
      type: "text",
      value,
      placeholder,
      readOnly: Boolean(readOnly),
      onChange: (event) => onChange && onChange(event.target.value),
    }),
  ]);
}

function DateField({ label, value, onChange }) {
  return h("label", { className: "field" }, [
    h("span", null, label),
    h("input", {
      type: "date",
      value,
      onChange: (event) => onChange(event.target.value),
    }),
  ]);
}

function NumberField({ label, value, onChange, min, max, step }) {
  return h("label", { className: "field" }, [
    h("span", null, label),
    h("input", {
      type: "number",
      value,
      min,
      max,
      step,
      onChange: (event) => onChange(numberFromInput(event.target.value, min || 0)),
    }),
  ]);
}

function SelectField({ label, value, onChange, options }) {
  return h("label", { className: "field" }, [
    h("span", null, label),
    h(
      "select",
      { value, onChange: (event) => onChange(event.target.value) },
      options.map((option) => h("option", { key: option.value, value: option.value }, option.label))
    ),
  ]);
}

function h(type, props, children) {
  return React.createElement(type, props, children);
}

createRoot(document.getElementById("root")).render(h(App));
