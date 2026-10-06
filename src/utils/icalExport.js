import { addDays, toISODate } from './calendarEvents';

function toICSDate(isoDate) {
  return isoDate.replaceAll('-', '');
}

function escapeICS(text) {
  return String(text).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

// Génère un fichier iCalendar (.ics) : DTEND est exclusif dans la norme, donc on ajoute
// un jour à date_fin (inclusive côté app) pour représenter correctement les événements "journée entière".
export function buildICS(events, calendarName) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FiXeo//Calendrier//FR',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeICS(calendarName)}`
  ];

  events.forEach((e) => {
    const endExclusive = toISODate(addDays(e.date_fin, 1));
    lines.push(
      'BEGIN:VEVENT',
      `UID:evt-${e.id_evenement}@quickrepair`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${toICSDate(e.date_debut)}`,
      `DTEND;VALUE=DATE:${toICSDate(endExclusive)}`,
      `SUMMARY:${escapeICS(e.titre)}`,
      'END:VEVENT'
    );
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadICS(events, calendarName) {
  const ics = buildICS(events, calendarName);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${calendarName.replace(/\s+/g, '_')}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
