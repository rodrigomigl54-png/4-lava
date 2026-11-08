import info from '../data/info.json';
import { ITEMS, CATEGORIES } from './menu';
import { pick, localePath, HTML_LANG, type Locale } from './i18n';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function restaurantLD(l: Locale, site: URL) {
  const week = info.hours.week as Record<string, [string, string][]>;
  const hours = Object.entries(week).flatMap(([d, ranges]) =>
    ranges.map(([opens, closes]) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: `https://schema.org/${DAYS[Number(d) - 1]}`, opens, closes })),
  );
  return {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    '@id': new URL('/#restaurant', site).href,
    name: l === 'sr' ? info.name.sr : info.name.lat,
    alternateName: [info.name.sr, info.name.lat, info.name.enAlt],
    url: new URL(localePath(l, '/'), site).href,
    image: new URL('/og.jpg', site).href,
    logo: new URL('/brand/logo-lion.svg', site).href,
    telephone: info.phone.intlDisplay.replace(/\s/g, ' '),
    priceRange: info.priceRange,
    currenciesAccepted: 'RSD',
    servesCuisine: ['Serbian', 'Central European'],
    acceptsReservations: true,
    address: {
      '@type': 'PostalAddress',
      streetAddress: l === 'sr' ? info.address.street : info.address.en.street,
      postalCode: info.address.postalCode,
      addressLocality: l === 'sr' ? info.address.city : info.address.en.city,
      addressCountry: info.address.country,
    },
    geo: { '@type': 'GeoCoordinates', latitude: info.geo.lat, longitude: info.geo.lng },
    hasMap: info.links.googleMaps,
    openingHoursSpecification: hours,
    aggregateRating: { '@type': 'AggregateRating', ratingValue: info.rating.value, reviewCount: info.rating.count, bestRating: 5 },
    hasMenu: new URL(localePath(l, '/meni/'), site).href,
    inLanguage: HTML_LANG[l],
  };
}

export function menuLD(l: Locale, site: URL) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Menu',
    '@id': new URL(localePath(l, '/meni/') + '#menu', site).href,
    name: l === 'en' ? 'Menu — Gostiona Kod 4 Lava' : pick(l, 'Јеловник — Гостиона Код 4 Лава'),
    inLanguage: HTML_LANG[l],
    hasMenuSection: CATEGORIES.map((c) => ({
      '@type': 'MenuSection',
      name: pick(l, c.name),
      hasMenuItem: ITEMS.filter((i) => i.category === c.id).map((i) => ({
        '@type': 'MenuItem',
        name: pick(l, i.name),
        ...(pick(l, i.desc) ? { description: pick(l, i.desc) } : {}),
        ...(i.price != null ? { offers: { '@type': 'Offer', price: i.price, priceCurrency: 'RSD' } } : {}),
        ...(i.tags.includes('vegetarian') ? { suitableForDiet: 'https://schema.org/VegetarianDiet' } : {}),
      })),
    })).filter((s) => s.hasMenuItem.length),
  };
}
