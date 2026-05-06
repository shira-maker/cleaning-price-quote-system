(function () {
  "use strict";

const WEEKS_PER_MONTH = 4.3;
const KM_COST_PER_KM = 1;
const TRAVEL_SOCIAL_RATE = 0.05;
const MIN_MARGIN = 0.1;
const MAX_MARGIN = 0.15;
const MAX_DAILY_HOURS = 12;

/**
 * @typedef {Object} ContactPerson
 * @property {string} id
 * @property {string} name
 * @property {string} [role]
 * @property {string} [phone]
 * @property {string} [email]
 */

/**
 * @typedef {Object} WorkGroup
 * @property {string} id
 * @property {string} name
 * @property {number} workers
 * @property {number} hourly_wage
 * @property {number} days_per_week
 * @property {number} hours_per_day
 * @property {number} overtime_hours_per_day
 * @property {boolean} is_shabbat
 */

/**
 * @typedef {Object} Site
 * @property {string} id
 * @property {string} name
 * @property {string} [address]
 * @property {number} km_one_direction
 * @property {number} trips_per_shift
 * @property {number} [driver_bonus_per_shift]
 * @property {ContactPerson[]} contact_people
 * @property {WorkGroup[]} work_groups
 */

/**
 * @typedef {Object} Client
 * @property {string} id
 * @property {string} name
 * @property {ContactPerson[]} contact_people
 * @property {Site[]} sites
 */

/**
 * @typedef {Object} QuoteInput
 * @property {Client} client
 * @property {number} margin
 */

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundHours(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function requiredObject(value, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
}

function requiredArray(value, path, { minLength = 0 } = {}) {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array`);
  }

  if (value.length < minLength) {
    throw new Error(`${path} must include at least ${minLength} item(s)`);
  }
}

function requiredString(value, path) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${path} is required`);
  }
}

function requiredNumber(value, path, { min = 0, max = Infinity, integer = false } = {}) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`${path} must be a number`);
  }

  if (value < min || value > max) {
    throw new Error(`${path} must be between ${min} and ${max}`);
  }

  if (integer && !Number.isInteger(value)) {
    throw new Error(`${path} must be an integer`);
  }
}

function requiredBoolean(value, path) {
  if (typeof value !== "boolean") {
    throw new Error(`${path} must be a boolean`);
  }
}

function validateContactPerson(contact, path) {
  requiredObject(contact, path);
  requiredString(contact.id, `${path}.id`);
  requiredString(contact.name, `${path}.name`);
}

function validateWorkGroup(group, path) {
  requiredObject(group, path);
  requiredString(group.id, `${path}.id`);
  requiredString(group.name, `${path}.name`);
  requiredNumber(group.workers, `${path}.workers`, { min: 1, integer: true });
  requiredNumber(group.hourly_wage, `${path}.hourly_wage`, { min: 0 });
  requiredNumber(group.days_per_week, `${path}.days_per_week`, { min: 1, max: 7 });
  requiredNumber(group.hours_per_day, `${path}.hours_per_day`, { min: 0.01, max: MAX_DAILY_HOURS });
  requiredNumber(group.overtime_hours_per_day, `${path}.overtime_hours_per_day`, { min: 0 });
  requiredBoolean(group.is_shabbat, `${path}.is_shabbat`);

  const totalDailyHours = group.hours_per_day + group.overtime_hours_per_day;
  if (totalDailyHours > MAX_DAILY_HOURS) {
    throw new Error(`${path} exceeds ${MAX_DAILY_HOURS} total hours per day`);
  }
}

function validateSite(site, path) {
  requiredObject(site, path);
  requiredString(site.id, `${path}.id`);
  requiredString(site.name, `${path}.name`);
  requiredNumber(site.km_one_direction, `${path}.km_one_direction`, { min: 0 });
  requiredNumber(site.trips_per_shift, `${path}.trips_per_shift`, { min: 0 });
  if (site.driver_bonus_per_shift !== undefined) {
    requiredNumber(site.driver_bonus_per_shift, `${path}.driver_bonus_per_shift`, { min: 0 });
  }

  requiredArray(site.contact_people, `${path}.contact_people`);
  site.contact_people.forEach((contact, index) => validateContactPerson(contact, `${path}.contact_people[${index}]`));

  requiredArray(site.work_groups, `${path}.work_groups`, { minLength: 1 });
  site.work_groups.forEach((group, index) => validateWorkGroup(group, `${path}.work_groups[${index}]`));
}

function validateClient(client, path = "client") {
  requiredObject(client, path);
  requiredString(client.id, `${path}.id`);
  requiredString(client.name, `${path}.name`);

  requiredArray(client.contact_people, `${path}.contact_people`);
  client.contact_people.forEach((contact, index) => validateContactPerson(contact, `${path}.contact_people[${index}]`));

  requiredArray(client.sites, `${path}.sites`, { minLength: 1 });
  client.sites.forEach((site, index) => validateSite(site, `${path}.sites[${index}]`));
}

function validateMargin(margin) {
  requiredNumber(margin, "margin", { min: MIN_MARGIN, max: MAX_MARGIN });
}

function calculateTravel(site, hoursPerDay) {
  const totalKmPerShift = site.km_one_direction * 2 * site.trips_per_shift;
  const dailyTravelCost = totalKmPerShift * KM_COST_PER_KM;
  const dailyDriverBonus = site.driver_bonus_per_shift || 0;
  const dailyTravelAndDriverBonusCost = dailyTravelCost + dailyDriverBonus;
  const travelPerRegularHour = dailyTravelAndDriverBonusCost / hoursPerDay;

  return {
    total_km_per_shift: totalKmPerShift,
    daily_travel_cost: dailyTravelCost,
    daily_driver_bonus: dailyDriverBonus,
    daily_travel_and_driver_bonus_cost: dailyTravelAndDriverBonusCost,
    travel_per_regular_hour: travelPerRegularHour,
  };
}

function calculateOvertime(group, hourlyBaseWithShabbat) {
  const first125Hours = Math.min(group.overtime_hours_per_day, 2);
  const beyond150Hours = Math.max(group.overtime_hours_per_day - 2, 0);

  return {
    first_125_hours_per_day: first125Hours,
    beyond_150_hours_per_day: beyond150Hours,
    hourly_rate_125: hourlyBaseWithShabbat * 1.25,
    hourly_rate_150: hourlyBaseWithShabbat * 1.5,
  };
}

function calculateMargin(cost, margin) {
  return {
    margin,
    price: cost / (1 - margin),
    profit: cost / (1 - margin) - cost,
  };
}

function summarize(results) {
  const monthlyHours = results.reduce((sum, result) => sum + result.raw.monthly_hours, 0);
  const monthlyCost = results.reduce((sum, result) => sum + result.raw.monthly_cost, 0);
  const monthlyPrice = results.reduce((sum, result) => sum + result.raw.monthly_price, 0);

  return {
    hourly_cost: monthlyCost / monthlyHours,
    final_price: monthlyPrice / monthlyHours,
    monthly_hours: monthlyHours,
    monthly_cost: monthlyCost,
    monthly_price: monthlyPrice,
    profit: monthlyPrice - monthlyCost,
  };
}

function formatSummary(summary) {
  return {
    hourly_cost: roundMoney(summary.hourly_cost),
    final_price: roundMoney(summary.final_price),
    monthly_hours: roundHours(summary.monthly_hours),
    monthly_cost: roundMoney(summary.monthly_cost),
    monthly_price: roundMoney(summary.monthly_price),
    profit: roundMoney(summary.profit),
    raw: summary,
  };
}

function pickContactFields(contact) {
  return {
    id: contact.id,
    name: contact.name,
    role: contact.role || null,
    phone: contact.phone || null,
    email: contact.email || null,
  };
}

function pickWorkGroupFields(group) {
  return {
    id: group.id,
    name: group.name,
    workers: group.workers,
    hourly_wage: group.hourly_wage,
    days_per_week: group.days_per_week,
    hours_per_day: group.hours_per_day,
    overtime_hours_per_day: group.overtime_hours_per_day,
    is_shabbat: group.is_shabbat,
  };
}

function pickSiteFields(site) {
  return {
    id: site.id,
    name: site.name,
    address: site.address || null,
    km_one_direction: site.km_one_direction,
    trips_per_shift: site.trips_per_shift,
    driver_bonus_per_shift: site.driver_bonus_per_shift || 0,
    contact_people: site.contact_people.map(pickContactFields),
  };
}

/**
 * Calculates one work group inside one site.
 *
 * @param {WorkGroup} group
 * @param {Site} site
 * @param {number} margin
 * @returns {Object}
 */
function calculateWorkGroup(group, site, margin) {
  validateWorkGroup(group, "work_group");
  validateMargin(margin);

  const hourlyBase = group.hourly_wage * 1.5;
  const shabbatMultiplier = group.is_shabbat ? 1.5 : 1;
  const regularSalaryPerHour = hourlyBase * shabbatMultiplier;
  const overtime = calculateOvertime(group, regularSalaryPerHour);
  const travel = calculateTravel(site, group.hours_per_day);

  const monthlyWorkDays = group.days_per_week * WEEKS_PER_MONTH;
  const monthlyRegularHours = group.workers * monthlyWorkDays * group.hours_per_day;
  const monthlyOvertimeHours = group.workers * monthlyWorkDays * group.overtime_hours_per_day;
  const monthlyBillableHours = monthlyRegularHours;

  const monthlyRegularSalaryCost = monthlyRegularHours * regularSalaryPerHour;
  const dailyOvertimeCost =
    overtime.first_125_hours_per_day * overtime.hourly_rate_125 +
    overtime.beyond_150_hours_per_day * overtime.hourly_rate_150;
  const monthlyOvertimeCost = group.workers * monthlyWorkDays * dailyOvertimeCost;
  const monthlyTravelCost = monthlyWorkDays * travel.daily_travel_cost;
  const monthlyDriverBonusCost = monthlyWorkDays * travel.daily_driver_bonus;
  const monthlyTravelSocialCost = (monthlyTravelCost + monthlyDriverBonusCost) * TRAVEL_SOCIAL_RATE;
  const monthlyCost = monthlyRegularSalaryCost + monthlyOvertimeCost + monthlyTravelCost + monthlyDriverBonusCost + monthlyTravelSocialCost;
  const hourlyCost = monthlyCost / monthlyBillableHours;
  const priced = calculateMargin(hourlyCost, margin);
  const monthlyPrice = priced.price * monthlyBillableHours;

  return {
    work_group: pickWorkGroupFields(group),
    hourly_cost: roundMoney(hourlyCost),
    final_price: roundMoney(priced.price),
    monthly_hours: roundHours(monthlyBillableHours),
    monthly_cost: roundMoney(monthlyCost),
    monthly_price: roundMoney(monthlyPrice),
    profit: roundMoney(monthlyPrice - monthlyCost),
    raw: {
      hourly_cost: hourlyCost,
      final_price: priced.price,
      monthly_hours: monthlyBillableHours,
      monthly_cost: monthlyCost,
      monthly_price: monthlyPrice,
      profit: monthlyPrice - monthlyCost,
    },
    breakdown: {
      salary: {
        hourly_wage: roundMoney(group.hourly_wage),
        base_multiplier: 1.5,
        hourly_base: roundMoney(hourlyBase),
        shabbat_multiplier: shabbatMultiplier,
        regular_salary_per_hour: roundMoney(regularSalaryPerHour),
        monthly_regular_hours: roundHours(monthlyRegularHours),
        monthly_regular_salary_cost: roundMoney(monthlyRegularSalaryCost),
      },
      overtime: {
        first_125_hours_per_day: roundHours(overtime.first_125_hours_per_day),
        beyond_150_hours_per_day: roundHours(overtime.beyond_150_hours_per_day),
        monthly_overtime_hours: roundHours(monthlyOvertimeHours),
        hourly_rate_125: roundMoney(overtime.hourly_rate_125),
        hourly_rate_150: roundMoney(overtime.hourly_rate_150),
        monthly_overtime_cost: roundMoney(monthlyOvertimeCost),
      },
      travel: {
        km_cost_per_km: KM_COST_PER_KM,
        total_km_per_shift: roundHours(travel.total_km_per_shift),
        daily_travel_cost: roundMoney(travel.daily_travel_cost),
        daily_driver_bonus: roundMoney(travel.daily_driver_bonus),
        travel_per_regular_hour: roundMoney(travel.travel_per_regular_hour),
        monthly_travel_cost: roundMoney(monthlyTravelCost),
        monthly_driver_bonus_cost: roundMoney(monthlyDriverBonusCost),
        travel_social_rate: TRAVEL_SOCIAL_RATE,
        monthly_travel_social_cost: roundMoney(monthlyTravelSocialCost),
      },
      margin: {
        margin,
        markup_factor: roundHours(1 / (1 - margin)),
        hourly_profit: roundMoney(priced.profit),
      },
    },
  };
}

/**
 * Calculates all work groups in one site.
 *
 * @param {Site} site
 * @param {number} margin
 * @returns {Object}
 */
function calculateSite(site, margin) {
  validateSite(site, "site");
  validateMargin(margin);

  const workGroups = site.work_groups.map((group) => calculateWorkGroup(group, site, margin));
  const summary = formatSummary(summarize(workGroups));

  return {
    site: pickSiteFields(site),
    hourly_cost: summary.hourly_cost,
    final_price: summary.final_price,
    monthly_hours: summary.monthly_hours,
    monthly_cost: summary.monthly_cost,
    monthly_price: summary.monthly_price,
    profit: summary.profit,
    raw: summary.raw,
    work_groups: workGroups,
  };
}

/**
 * Calculates a full quote for one client with one or more sites.
 *
 * @param {QuoteInput} quote
 * @returns {Object}
 */
function calculateQuote(quote) {
  requiredObject(quote, "quote");
  validateMargin(quote.margin);
  validateClient(quote.client);

  const sites = quote.client.sites.map((site) => calculateSite(site, quote.margin));
  const summary = formatSummary(summarize(sites));

  return {
    client: {
      id: quote.client.id,
      name: quote.client.name,
      contact_people: quote.client.contact_people.map(pickContactFields),
    },
    margin: quote.margin,
    hourly_cost: summary.hourly_cost,
    final_price: summary.final_price,
    monthly_hours: summary.monthly_hours,
    monthly_cost: summary.monthly_cost,
    monthly_price: summary.monthly_price,
    profit: summary.profit,
    raw: summary.raw,
    sites,
  };
}

const examples = [
  {
    name: "Single site, regular shift",
    input: {
      margin: 0.12,
      client: {
        id: "client-scottish-hospital",
        name: "Scottish Hospital",
        contact_people: [{ id: "contact-1", name: "Main Contact", role: "Operations" }],
        sites: [
          {
            id: "site-1",
            name: "Main Building",
            address: "Jerusalem",
            km_one_direction: 12,
            trips_per_shift: 1,
            contact_people: [{ id: "site-contact-1", name: "Facilities Manager" }],
            work_groups: [
              {
                id: "group-1",
                name: "Morning team",
                workers: 3,
                hourly_wage: 35,
                days_per_week: 5,
                hours_per_day: 6,
                overtime_hours_per_day: 0,
                is_shabbat: false,
              },
            ],
          },
        ],
      },
    },
  },
  {
    name: "Two groups with overtime",
    input: {
      margin: 0.15,
      client: {
        id: "client-industrial",
        name: "Industrial Client",
        contact_people: [{ id: "contact-1", name: "Procurement" }],
        sites: [
          {
            id: "site-1",
            name: "Production Site",
            km_one_direction: 20,
            trips_per_shift: 2,
            contact_people: [],
            work_groups: [
              {
                id: "group-1",
                name: "Daily cleaning",
                workers: 4,
                hourly_wage: 38,
                days_per_week: 5,
                hours_per_day: 8,
                overtime_hours_per_day: 2,
                is_shabbat: false,
              },
              {
                id: "group-2",
                name: "Evening support",
                workers: 1,
                hourly_wage: 42,
                days_per_week: 3,
                hours_per_day: 7,
                overtime_hours_per_day: 1,
                is_shabbat: false,
              },
            ],
          },
        ],
      },
    },
  },
  {
    name: "Multiple sites including Shabbat",
    input: {
      margin: 0.1,
      client: {
        id: "client-institution",
        name: "Institutional Client",
        contact_people: [{ id: "contact-1", name: "Administration" }],
        sites: [
          {
            id: "site-1",
            name: "Weekday Site",
            km_one_direction: 8,
            trips_per_shift: 1,
            contact_people: [],
            work_groups: [
              {
                id: "group-1",
                name: "Weekday team",
                workers: 2,
                hourly_wage: 36,
                days_per_week: 6,
                hours_per_day: 7,
                overtime_hours_per_day: 1,
                is_shabbat: false,
              },
            ],
          },
          {
            id: "site-2",
            name: "Shabbat Site",
            km_one_direction: 30,
            trips_per_shift: 1,
            contact_people: [],
            work_groups: [
              {
                id: "group-2",
                name: "Shabbat team",
                workers: 2,
                hourly_wage: 40,
                days_per_week: 1,
                hours_per_day: 8,
                overtime_hours_per_day: 2,
                is_shabbat: true,
              },
            ],
          },
        ],
      },
    },
  },
];

if (typeof require !== "undefined" && require.main === module) {
  for (const example of examples) {
    console.log(`\n${example.name}`);
    console.log(JSON.stringify(calculateQuote(example.input), null, 2));
  }
}

const PricingEngine = {
  calculateQuote,
  calculatePricing: calculateQuote,
  calculateSite,
  calculateWorkGroup,
  validateClient,
  validateSite,
  validateWorkGroup,
};

if (typeof window !== "undefined") {
  window.PricingEngine = PricingEngine;
}
})();
