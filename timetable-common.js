(function (global) {
    const PREFERRED_TIMETABLE_FILE = 'Term4_W5.xml';
    const DEFAULT_TIMETABLE_FILES = [PREFERRED_TIMETABLE_FILE, 'Term4_W6-7.xml'];

    // UPDATE HERE when uploading new timetable XMLs: one entry per file, with inclusive start/end dates (YYYY-MM-DD).
    // Dates outside every entry have no timetable data.
    const TIMETABLE_SCHEDULE = [
        { start: '2026-10-12', end: '2026-10-18', file: 'Term4_W5.xml' },
        { start: '2026-10-19', end: '2026-10-30', file: 'Term4_W6-7.xml' }
    ];

    function toIsoDate(date) {
        if (typeof date === 'string') return date.slice(0, 10);
        const p = (n) => String(n).padStart(2, '0');
        return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
    }

    // Accepts a Date or 'YYYY-MM-DD'; returns null when no timetable covers the date.
    function getTimetableFileForDate(date) {
        const iso = toIsoDate(date);
        const entry = TIMETABLE_SCHEDULE.find((e) => e.start <= iso && iso <= e.end);
        return entry ? entry.file : null;
    }

    function getTimetableCoverage() {
        return {
            start: TIMETABLE_SCHEDULE[0].start,
            end: TIMETABLE_SCHEDULE[TIMETABLE_SCHEDULE.length - 1].end
        };
    }

    function clampToCoverage(date) {
        const iso = toIsoDate(date);
        const { start, end } = getTimetableCoverage();
        return iso < start ? start : iso > end ? end : iso;
    }

    function getNoTimetableMessage() {
        const { start, end } = getTimetableCoverage();
        return `No timetable data for this date. Timetables are available from ${start} to ${end}.`;
    }

    // Splits an inclusive 'YYYY-MM-DD' range into per-file segments covered by the schedule.
    function getTimetableSegments(startIso, endIso) {
        const segments = [];
        TIMETABLE_SCHEDULE.forEach((entry) => {
            const from = entry.start > startIso ? entry.start : startIso;
            const to = entry.end < endIso ? entry.end : endIso;
            if (from <= to) segments.push({ file: entry.file, start: from, end: to });
        });
        return segments;
    }

    function getTimetablePathForDate(date) {
        const file = getTimetableFileForDate(date);
        return file ? `timetables/${file}` : null;
    }

    function parseXmlDocument(xmlText) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        if (xmlDoc.querySelector('parsererror')) {
            throw new Error('Invalid XML file');
        }
        return xmlDoc;
    }

    async function loadFirstAvailableXML(basePath = 'timetables/', fileNames = DEFAULT_TIMETABLE_FILES) {
        for (const name of fileNames) {
            try {
                const response = await fetch(`${basePath}${name}`);
                if (!response.ok) continue;
                const xmlText = await response.text();
                return parseXmlDocument(xmlText);
            } catch {
                // try next fallback file
            }
        }
        throw new Error(`No XML timetable files could be loaded from ${basePath}`);
    }

    function createMappingsTemplate(includeWeeksdef = false) {
        const base = {
            teachers: {},
            subjects: {},
            rooms: {},
            classes: {},
            periods: {},
            daysdef: {}
        };

        if (includeWeeksdef) {
            base.weeksdef = {};
        }

        return base;
    }

    function buildMappings(xmlDoc, options = {}) {
        const { includeWeeksdef = false } = options;
        const mappings = createMappingsTemplate(includeWeeksdef);

        xmlDoc.querySelectorAll('teacher').forEach((teacher) => {
            mappings.teachers[teacher.getAttribute('id')] = {
                id: teacher.getAttribute('id'),
                name: teacher.getAttribute('name'),
                short: teacher.getAttribute('short')
            };
        });

        xmlDoc.querySelectorAll('subject').forEach((subject) => {
            mappings.subjects[subject.getAttribute('id')] = {
                id: subject.getAttribute('id'),
                name: subject.getAttribute('name'),
                short: subject.getAttribute('short')
            };
        });

        xmlDoc.querySelectorAll('classroom').forEach((room) => {
            mappings.rooms[room.getAttribute('id')] = {
                id: room.getAttribute('id'),
                name: room.getAttribute('name'),
                short: room.getAttribute('short')
            };
        });

        xmlDoc.querySelectorAll('class').forEach((cls) => {
            mappings.classes[cls.getAttribute('id')] = {
                id: cls.getAttribute('id'),
                name: cls.getAttribute('name'),
                short: cls.getAttribute('short')
            };
        });

        xmlDoc.querySelectorAll('period').forEach((period) => {
            const periodSlot = period.getAttribute('period');
            mappings.periods[periodSlot] = {
                id: periodSlot,
                sourceId: period.getAttribute('id'),
                start: period.getAttribute('starttime'),
                end: period.getAttribute('endtime')
            };
        });

        xmlDoc.querySelectorAll('daysdef').forEach((day) => {
            mappings.daysdef[day.getAttribute('id')] = {
                id: day.getAttribute('id'),
                days: day.getAttribute('days')
            };
        });

        if (includeWeeksdef) {
            xmlDoc.querySelectorAll('weeksdef').forEach((week) => {
                mappings.weeksdef[week.getAttribute('id')] = {
                    id: week.getAttribute('id'),
                    name: week.getAttribute('name'),
                    weeks: week.getAttribute('weeks')
                };
            });
        }

        return mappings;
    }

    function computeWeekTypeFromDate(dateObj) {
        const start = new Date(Date.UTC(2026, 0, 5));
        const toMonday = (x) => {
            const y = new Date(Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()));
            const w = y.getUTCDay();
            const diff = (w + 6) % 7;
            y.setUTCDate(y.getUTCDate() - diff);
            return y;
        };
        const a = toMonday(dateObj);
        const s = toMonday(start);
        const weeks = Math.floor((a - s) / (7 * 86400000));
        const blocks = [10, 10, 10, 10];
        const breaks = [1, 4, 1];
        let t = weeks;
        for (let i = 0; ; i++) {
            const b = blocks[i % blocks.length];
            if (t < b) {
                const n = (t + 1);
                return n % 2 === 1 ? 'odd' : 'even';
            }
            t -= b;
            const br = breaks
        getTimetableCoverage,
        clampToCoverage,
        getNoTimetableMessage,[i % breaks.length];
            if (t < br) {
                return 'odd';
            }
            t -= br;
        }
    }

    // Label such as 'Term 4 Week 5' for the school week containing the date.
    function getTermWeekLabel(dateObj) {
        const toMonday = (x) 
        getTimetableWeeks,
        getTermWeekLabel,=> {
            const y = new Date(Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()));
            y.setUTCDate(y.getUTCDate() - ((y.getUTCDay() + 6) % 7));
            return y;
        };
        const weeks = Math.floor((toMonday(dateObj) - toMonday(new Date(2026, 0, 5))) / (7 * 86400000));
        if (weeks < 0) return 'Before Term 1';
        const blocks = [10, 10, 10, 10];
        const breaks = [1, 4, 1];
        let t = weeks;
        for (let i = 0; ; i++) {
            const b = blocks[i % blocks.length];
            if (t < b) return `Term ${(i % blocks.length) + 1} Week ${t + 1}`;
            t -= b;
            const br = breaks[i % breaks.length];
            if (t < br) return 'School Holidays';
            t -= br;
        }
    }

    // One entry per calendar week in the range that has timetable data.
    function getTimetableWeeks(startIso, endIso) {
        const parse = (iso) => {
            const [y, m, d] = iso.split('-').map(Number);
            return new Date(y, m - 1, d);
        };
        const start = parse(startIso);
        const end = parse(endIso);
        const monday = new Date(start);
        monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
        const weeks = [];
        for (; monday <= end; monday.setDate(monday.getDate() + 7)) {
            let file = null;
            for (let k = 0; k < 7 && !file; k++) {
                const day = new Date(monday);
                day.setDate(day.getDate() + k);
                if (day >= start && day <= end) file = getTimetableFileForDate(day);
            }
            if (!file) continue;
            weeks.push({
                monday: toIsoDate(monday),
                label: getTermWeekLabel(monday),
                weekType: computeWeekTypeFromDate(monday),
                file
            });
        }
        return weeks;
    }

    function extractDepartmentCode(shortName) {
        if (!shortName) return n
        getTimetableSegments,ull;
        const m1 = shortName.match(/\[(.*?)\]/);
        if (m1) return m1[1];
        const m2 = shortName.match(/\{(.*?)\}/);
        if (m2) return m2[1];
        const m3 = shortName.match(/\((.*?)\)/);
        if (m3) return m3[1];
        const m4 = shortName.match(/-\s?([A-Za-z]{1,3})$/);
        if (m4) return m4[1];
        return null;
    }

    global.TimetableCommon = {
        PREFERRED_TIMETABLE_FILE,
        DEFAULT_TIMETABLE_FILES,
        TIMETABLE_SCHEDULE,
        getTimetableFileForDate,
        getTimetablePathForDate,
        toIsoDate,
        parseXmlDocument,
        loadFirstAvailableXML,
        createMappingsTemplate,
        buildMappings,
        computeWeekTypeFromDate,
        extractDepartmentCode
    };
})(window);
