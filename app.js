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
    name: "צוות ניקיון",
    workers: 1,
    hourly_wage: 35,
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
    km_one_direction: 0,
    trips_per_shift: 1,
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
    margin: 0.12,
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

function hours(value) {
  return new Intl.NumberFormat("he-IL", {
    maximumFractionDigits: 2,
  }).format(value || 0);
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
          h(Field, { label: "תאריך", value: form.quoteDate, readOnly: true }),
          h(Field, { label: "בתוקף עד", value: form.validUntil, readOnly: true }),
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
            step: 0.01,
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
      h(SelectField, {
        label: "נסיעות למשמרת",
        value: String(site.trips_per_shift),
        onChange: (value) => onChange(site.id, "trips_per_shift", Number(value)),
        options: [
          { value: "1", label: "1" },
          { value: "2", label: "2" },
        ],
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
            h(Metric, { label: "מחיר שעתי ללקוח", value: money(result.final_price) }),
            h(Metric, { label: "עלות שעתית", value: money(result.hourly_cost) }),
            h(Metric, { label: "שעות חודשיות", value: hours(result.monthly_hours) }),
            h(Metric, { label: "עלות חודשית", value: money(result.monthly_cost) }),
            h(Metric, { label: "מחיר חודשי", value: money(result.monthly_price) }),
            h(Metric, { label: "רווח חודשי", value: money(result.profit) }),
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
