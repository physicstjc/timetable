let xmlData = null;
let mappings = null;

// Week visibility configuration - set these to true/false to show/hide weeks
let showOddWeeks = true;   // Show odd week timetables
let showEvenWeeks = true;  // Show even week timetables

function computeWeekTypeFromDate(dateObj) {
    const start = new Date(Date.UTC(2026, 0, 5));
    const toMonday = (x) => {
        const y = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));
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
        const br = breaks[i % breaks.length];
        if (t < br) {
            return 'odd';
        }
        t -= br;
    }
}
function setTimetableXML(xmlDoc) {
    // Update internal state
    xmlData = xmlDoc;
    window.xmlData = xmlDoc;
    mappings = getMappings(xmlDoc);

    // Show preview section if present
    const previewSection = document.getElementById('previewSection');
    if (previewSection) {
        previewSection.style.display = 'block';
    }

    // Refresh department and teacher lists if elements exist
    const departmentSelect = document.getElementById('departmentSelect');
    const teacherSelect = document.getElementById('teacherSelect');

    if (departmentSelect) {
        populateDepartmentSelect();
        // Reset filter to "All Departments" to avoid empty teacher list after XML change
        departmentSelect.value = '';
    }

    if (teacherSelect) {
        updateTeacherSelect();

        // Keep blank default; do not auto-select any teacher
        teacherSelect.selectedIndex = 0;

        // Clear preview since no teacher is selected by default
        const tablesContainer = document.getElementById('timetableTables');
        if (tablesContainer) tablesContainer.innerHTML = '';

        // Ensure teacher change triggers preview refresh
        teacherSelect.onchange = (e) => {
            updatePreview(e.target.value);
        };
    }
}
window.setTimetableXML = setTimetableXML;

function loadXMLData(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(e.target.result, 'text/xml');
                if (xmlDoc.querySelector('parsererror')) {
                    throw new Error('Invalid XML file');
                }
                resolve(xmlDoc);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = () => reject(new Error('Error reading file'));
        reader.readAsText(file);
    });
}

function getMappings(xmlDoc) {
    const mappings = {
        teachers: {},
        periods: {},
        subjects: {},
        rooms: {},
        daysdef: {},
        weeksdef: {},
        classes: {}  // Make sure classes is defined first
    };

    // Add class mapping first
    xmlDoc.querySelectorAll('class').forEach(cls => {
        mappings.classes[cls.getAttribute('id')] = {
            name: cls.getAttribute('name'),
            short: cls.getAttribute('short')
        };
    });

    // Fix period mapping
    xmlDoc.querySelectorAll('period').forEach(period => {
        mappings.periods[period.getAttribute('period')] = {
            id: period.getAttribute('id'),
            start: period.getAttribute('starttime'),
            end: period.getAttribute('endtime')
        };
    });

    // Fix room mapping
    xmlDoc.querySelectorAll('classroom').forEach(room => {
        mappings.rooms[room.getAttribute('id')] = {
            name: room.getAttribute('name'),
            short: room.getAttribute('short')
        };
    });

    // Add missing subject mapping
    xmlDoc.querySelectorAll('subject').forEach(subject => {
        mappings.subjects[subject.getAttribute('id')] = {
            name: subject.getAttribute('name'),
            short: subject.getAttribute('short')
        };
    });

    xmlDoc.querySelectorAll('teacher').forEach(teacher => {
        mappings.teachers[teacher.getAttribute('id')] = {
            name: teacher.getAttribute('name'),
            short: teacher.getAttribute('short')
        };
    });

    xmlDoc.querySelectorAll('daysdef').forEach(day => {
        mappings.daysdef[day.getAttribute('id')] = {
            days: day.getAttribute('days')
        };
    });

    xmlDoc.querySelectorAll('weeksdef').forEach(week => {
        mappings.weeksdef[week.getAttribute('id')] = {
            name: week.getAttribute('name'),
            weeks: week.getAttribute('weeks')
        };
    });

    return mappings;
}

// Add at the beginning of the file
async function loadDefaultXML() {
    try {
        // Try to list available XML files in the timetables folder
        const dirRes = await fetch('timetables/');
        if (dirRes.ok) {
            const html = await dirRes.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const links = Array.from(doc.querySelectorAll('a')).map(a => a.getAttribute('href') || '');
            const xmlFiles = links.filter(href => href.toLowerCase().endsWith('.xml'));

            if (xmlFiles.length > 0) {
                const preferred = ['Term1_W3_onwards.xml'];
                const chosen = xmlFiles.find(name => preferred.includes(name)) || xmlFiles[0];
                const path = `timetables/${chosen}`;
                const fileRes = await fetch(path);
                const xmlText = await fileRes.text();
                const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
                if (xmlDoc.querySelector('parsererror')) {
                    throw new Error('Invalid XML file');
                }
                return xmlDoc;
            }
        }

        // Fallback: try known timetable files
        const fallbackFiles = ['Term1_W3_onwards.xml', 'SOTY2026.xml'];
        for (const name of fallbackFiles) {
            try {
                const res = await fetch(`timetables/${name}`);
                if (res.ok) {
                    const xmlText = await res.text();
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
                    if (xmlDoc.querySelector('parsererror')) {
                        continue; // try next
                    }
                    return xmlDoc;
                }
            } catch {
                // continue to next fallback
            }
        }

        // Last resort: root-level asctt2012.xml (if present)
        try {
            const res = await fetch('SOTY2026.xml');
            if (res.ok) {
                const xmlText = await res.text();
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
                if (!xmlDoc.querySelector('parsererror')) {
                    return xmlDoc;
                }
            }
        } catch {
            // ignore and throw below
        }

        throw new Error('No XML timetable files found in timetables/ or project root');
    } catch (error) {
        console.warn('Failed to load default XML:', error);
        return null;
    }
}

// Add after the loadDefaultXML function
const departments = {
    'AA': 'Arts Aesthetics',
    'AE': 'Arts Economics',
    'AG': 'Arts Geography',
    'AH': 'Arts History',
    'AM': 'Arts Music',
    'E': 'English',
    'M': 'Mathematics',
    'MT': 'Mother Tongue Languages',
    'PE': 'Physical Education',
    'PW': 'Project Work',
    'SB': 'Science Biology',
    'SC': 'Science Chemistry',
    'SP': 'Science Physics'
};

// Modify the populateDepartmentSelect function
function populateDepartmentSelect() {
    // Guard against missing mappings or element
    if (!mappings || !mappings.teachers) return;
    const departmentSelect = document.getElementById('departmentSelect');
    if (!departmentSelect) return;
    const departmentSet = new Set();
    
    // Extract unique department codes from teacher short names
    Object.values(mappings.teachers).forEach(teacher => {
        const match = teacher.short?.match(/\[(.*?)[\]}]/);  // Handle both ] and } as closing brackets
        if (match && departments[match[1]]) {
            departmentSet.add(match[1]);
        }
    });
    departmentSelect.innerHTML = '<option value="">All Departments</option>';
    
    // Sort departments by their full names and create options
    Array.from(departmentSet)
        .sort((a, b) => departments[a].localeCompare(departments[b]))
        .forEach(dept => {
            const option = document.createElement('option');
            option.value = dept;
            option.textContent = departments[dept];
            departmentSelect.appendChild(option);
        });
}

// Modify the previewTimetable function
async function previewTimetable() {
    const fileInput = document.getElementById('xmlFile');
    const previewSection = document.getElementById('previewSection');
    const deptEl = document.getElementById('departmentSelect');
    const teacherEl = document.getElementById('teacherSelect');

    try {
        if (!xmlData) {
            if (fileInput && fileInput.files && fileInput.files[0]) {
                xmlData = await loadXMLData(fileInput.files[0]);
            } else {
                xmlData = await loadDefaultXML();
                if (!xmlData) {
                    alert('Please select an XML file');
                    return;
                }
            }
            mappings = getMappings(xmlData);
        }

        // Populate and reset department, then populate teachers
        if (deptEl) {
            populateDepartmentSelect();
            deptEl.value = '';
        }
        if (teacherEl) {
            updateTeacherSelect();

            // Keep blank default; do not auto-select any teacher
            teacherEl.selectedIndex = 0;
        }

        // Show preview section
        if (previewSection) {
            previewSection.style.display = 'block';
        }

        // Render preview if a teacher is selected
        if (teacherEl && teacherEl.value) {
            updatePreview(teacherEl.value);
        }
    } catch (error) {
        alert(`Error loading preview: ${error.message}`);
    }
}

// Add new function to update teacher select based on department
function updateTeacherSelect() {
    const departmentSelect = document.getElementById('departmentSelect');
    const teacherSelect = document.getElementById('teacherSelect');
    if (!teacherSelect || !mappings || !mappings.teachers) return;
    const selectedDepartment = departmentSelect ? departmentSelect.value : '';
    // Try to extract department code from multiple possible formats in short:
    // [E], {E}, (E), or suffix " - E"
    const extractDept = (short) => {
        if (!short) return null;
        const m1 = short.match(/\[(.*?)\]/);
        if (m1) return m1[1];
        const m2 = short.match(/\{(.*?)\}/);
        if (m2) return m2[1];
        const m3 = short.match(/\((.*?)\)/);
        if (m3) return m3[1];
        const m4 = short.match(/-\s?([A-Za-z]{1,3})$/);
        if (m4) return m4[1];
        return null;
    };

    const entries = Object.entries(mappings.teachers);
    const filtered = entries.filter(([, teacher]) => {
        if (!selectedDepartment) return true;
        const dept = extractDept(teacher.short);
        return dept === selectedDepartment;
    });

    // If filtering yields zero teachers, fall back to rendering all so the list isn't blank.
    const toRender = filtered.length > 0 ? filtered : entries;
        // Reset and populate with a blank placeholder
    teacherSelect.innerHTML = '<option value="">Select a teacher...</option>';
    toRender
        .sort(([, a], [, b]) => a.name.localeCompare(b.name))
        .forEach(([id, teacher]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = teacher.name;
            teacherSelect.appendChild(option);
        });

    // Do not auto-select any teacher; keep blank selected
    teacherSelect.selectedIndex = 0;

    if (!teacherSelect.value) {
        const tablesContainer = document.getElementById('timetableTables');
        if (tablesContainer) tablesContainer.innerHTML = '';
    }
        // Auto-select first teacher (skip placeholder) and refresh preview
    if (teacherSelect.options.length > 1) {
        teacherSelect.selectedIndex = 1;
        updatePreview(teacherSelect.value);
    } else {
        const tablesContainer = document.getElementById('timetableTables');
        if (tablesContainer) tablesContainer.innerHTML = '';
    }    
    Object.entries(mappings.teachers)
        .filter(([, teacher]) => {
            if (!selectedDepartment) return true;
            const match = teacher.short?.match(/\[(.*?)[\]}]/);  // Handle both ] and } as closing brackets
            return match && match[1] === selectedDepartment;
        })
        .sort(([, a], [, b]) => a.name.localeCompare(b.name))
        .forEach(([id, teacher]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = teacher.name;
            teacherSelect.appendChild(option);
        });


    // Auto-select first teacher (skip placeholder) and refresh preview
    if (teacherSelect.options.length > 1) {
        teacherSelect.selectedIndex = 1;
        updatePreview(teacherSelect.value);
    } else {
        const tablesContainer = document.getElementById('timetableTables');
        if (tablesContainer) tablesContainer.innerHTML = '';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await previewTimetable();

    const deptEl = document.getElementById('departmentSelect');
    if (deptEl) {
        // Reset on load and bind change
        deptEl.value = '';
        deptEl.addEventListener('change', updateTeacherSelect);
    }

    const teacherSelect = document.getElementById('teacherSelect');
    if (teacherSelect) {
        // Ensure teachers are populated and bind change
        updateTeacherSelect();

        // Ensure blank default on page load and clear preview
        teacherSelect.selectedIndex = 0;
        const tablesContainer = document.getElementById('timetableTables');
        if (tablesContainer) tablesContainer.innerHTML = '';

        teacherSelect.addEventListener('change', (e) => {
            updatePreview(e.target.value);
        });

        // Trigger initial preview only if a teacher is selected (blank by default)
        if (teacherSelect.value) {
            updatePreview(teacherSelect.value);
        }
    }
});

function updatePreview(teacherId) {
    const previewSection = document.getElementById('previewSection');
    if (!previewSection) return;

    // Ensure a container exists to hold the week tables
    let tablesContainer = document.getElementById('timetableTables');
    if (!tablesContainer) {
        tablesContainer = document.createElement('div');
        tablesContainer.id = 'timetableTables';
        previewSection.appendChild(tablesContainer);
    }

    // Build odd/even week tables
    let tablesHTML = '<div class="timetable-container">';
    if (showOddWeeks) {
        tablesHTML += `
            <div class="week-table">
                <h3 class="week-header">Odd Week</h3>
                <table id="oddWeekTable" class="preview-table">
                    <thead>
                        <tr>
                            <th>Day</th>
                            <th>Time</th>
                            <th>Subject</th>
                            <th>Room</th>
                            <th>Week Type</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>`;
    }
    if (showEvenWeeks) {
        tablesHTML += `
            <div class="week-table">
                <h3 class="week-header">Even Week</h3>
                <table id="evenWeekTable" class="preview-table">
                    <thead>
                        <tr>
                            <th>Day</th>
                            <th>Time</th>
                            <th>Subject</th>
                            <th>Room</th>
                            <th>Week Type</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>`;
    }
    tablesHTML += '</div>';

    // Write into the container
    tablesContainer.innerHTML = tablesHTML;

    // Continue with filling rows...
    const oddWeekTable = showOddWeeks ? document.getElementById('oddWeekTable').getElementsByTagName('tbody')[0] : null;
    const evenWeekTable = showEvenWeeks ? document.getElementById('evenWeekTable').getElementsByTagName('tbody')[0] : null;
    const lessons = xmlData.querySelectorAll(`lesson[teacherids*="${teacherId}"]`);
    const lessonMap = new Map();
    
    lessons.forEach(lesson => {
        const lessonId = lesson.getAttribute('id');
        const subjectId = lesson.getAttribute('subjectid');
        const subject = mappings.subjects[subjectId] || { name: 'Unknown', short: 'Unknown' };
        const weeksdefId = lesson.getAttribute('weeksdefid');
        
        if (subject.name.includes('HBL') || subject.name.includes('Home Based Learning')) {
            return;
        }

        const classIds = (lesson.getAttribute('classids') || '').split(',').filter(Boolean);
        const classNames = classIds.length > 3 
            ? 'Multiple Classes'
            : classIds.map(id => mappings.classes[id]?.name || 'Unknown').join(', ');

        const cards = xmlData.querySelectorAll(`card[lessonid="${lessonId}"]`);
        const dayGroups = new Map();
        
        cards.forEach(card => {
            const daysPattern = card.getAttribute('days');
            const periodId = parseInt(card.getAttribute('period'));
            const roomIds = (card.getAttribute('classroomids') || '').split(',').filter(Boolean);
            const rooms = roomIds.map(id => mappings.rooms[id]?.name || 'Unknown');
            const roomDisplay = rooms.length > 2 ? 'Multiple Venues' : rooms.join(' & ');
            
            let weekPatterns;
            if (weeksdefId === '4CEEF5CAAC1CEE35') {
                weekPatterns = ['11'];
            } else if (weeksdefId === 'F20BB99A3CE4D221') {
                weekPatterns = ['01'];
            } else if (weeksdefId === '1DE69DF37257B010') {
                weekPatterns = ['10'];
            } else {
                weekPatterns = [card.getAttribute('weeks')];
            }
            
            weekPatterns.forEach(weeks => {
                for (let dayIndex = 0; dayIndex < daysPattern.length; dayIndex++) {
                    if (daysPattern[dayIndex] !== '1') continue;
                    
                    const key = `${dayIndex}-${weeks}-${roomDisplay}`;
                    if (!dayGroups.has(key)) {
                        dayGroups.set(key, {
                            startPeriod: periodId,
                            endPeriod: periodId,
                            weeks,
                            dayIndex,
                            room: roomDisplay,
                            subject: subject.name,
                            className: classNames
                        });
                    } else {
                        const group = dayGroups.get(key);
                        if (periodId === group.endPeriod + 1) {
                            group.endPeriod = periodId;
                        }
                    }
                }
            });
        });

        dayGroups.forEach((group, key) => {
            const startPeriodInfo = mappings.periods[group.startPeriod];
            const endPeriodInfo = mappings.periods[group.endPeriod];
            
            const weekType = group.weeks === '11' ? 'Every Week' : 
                           group.weeks === '10' ? 'Odd Week' : 
                           group.weeks === '01' ? 'Even Week' : 'Every Week';
            
            lessonMap.set(key, {
                day: group.dayIndex,
                startTime: startPeriodInfo?.start || '07:30',
                endTime: endPeriodInfo?.end || '08:00',
                subject: group.subject,
                className: group.className,
                room: group.room,
                weekType: weekType,
                isOddWeek: weekType === 'Odd Week',
                startPeriod: group.startPeriod
            });
        });
    });

    const lessonEntries = Array.from(lessonMap.values()).sort((a, b) => {
        if (a.day !== b.day) return a.day - b.day;
        return a.startPeriod - b.startPeriod;
    });

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    
    // Create row HTML for a lesson entry
    const createRow = entry => `
        <tr>
            <td>${days[entry.day]}</td>
            <td>${entry.startTime} - ${entry.endTime}</td>
            <td>${entry.subject}${entry.className ? ` (${entry.className})` : ''}</td>
            <td>${entry.room}</td>
            <td>${entry.weekType}</td>
        </tr>
    `;

    // Filter and display lessons for each week
    const oddWeekLessons = lessonEntries.filter(entry => 
        entry.weekType === 'Odd Week' || entry.weekType === 'Every Week'
    );
    const evenWeekLessons = lessonEntries.filter(entry => 
        entry.weekType === 'Even Week' || entry.weekType === 'Every Week'
    );

    if (oddWeekTable) {
        oddWeekTable.innerHTML = oddWeekLessons.length ? 
            oddWeekLessons.map(createRow).join('') : 
            '<tr><td colspan="5">No lessons found for this week</td></tr>';
    }

    if (evenWeekTable) {
        evenWeekTable.innerHTML = evenWeekLessons.length ? 
            evenWeekLessons.map(createRow).join('') : 
            '<tr><td colspan="5">No lessons found for this week</td></tr>';
    }
}

window.createTeacherCalendar = function(teacherId, startDate, endDate, startWeekType) {
    const cal = new ICAL.Component(['vcalendar', [], []]);
    cal.updatePropertyWithValue('prodid', '-//Timetable Calendar//EN');
    cal.updatePropertyWithValue('version', '2.0');
    cal.updatePropertyWithValue('calscale', 'GREGORIAN');
    cal.updatePropertyWithValue('x-wr-calname', `Timetable - ${teacherId}`);
    cal.updatePropertyWithValue('x-wr-timezone', 'Asia/Singapore');

    const lessons = xmlData.querySelectorAll(`lesson[teacherids*="${teacherId}"]`);
    console.log(`Found ${lessons.length} total lessons for teacher ${teacherId}`);
    
    const firstWeekDate = new Date(startDate);
    
    lessons.forEach(lesson => {
        const lessonId = lesson.getAttribute('id');
        const subjectId = lesson.getAttribute('subjectid');
        const subject = mappings.subjects[subjectId] || { name: 'Unknown', short: 'Unknown' };
        const weeksdefId = lesson.getAttribute('weeksdefid');
        
        if (subject.name.includes('HBL') || subject.name.includes('Home Based Learning')) {
            return;
        }

        const cards = xmlData.querySelectorAll(`card[lessonid="${lessonId}"]`);
        const dayGroups = new Map();
        
        cards.forEach(card => {
            const daysPattern = card.getAttribute('days');
            const periodId = parseInt(card.getAttribute('period'));
            
            // Update week pattern handling
            let weekPatterns;
            if (weeksdefId === '4CEEF5CAAC1CEE35') {
                // For every week lessons, use interval: 1 instead of patterns
                weekPatterns = ['11'];
            } else if (weeksdefId === 'F20BB99A3CE4D221') {
                weekPatterns = ['01'];
            } else if (weeksdefId === '1DE69DF37257B010') {
                weekPatterns = ['10'];
            } else {
                weekPatterns = [card.getAttribute('weeks')];
            }
            
            weekPatterns.forEach(weeks => {
                for (let dayIndex = 0; dayIndex < daysPattern.length; dayIndex++) {
                    if (daysPattern[dayIndex] !== '1') continue;
                    
                    const key = `${dayIndex}-${weeks}`;
                    if (!dayGroups.has(key)) {
                        dayGroups.set(key, {
                            startPeriod: periodId,
                            endPeriod: periodId,
                            weeks,
                            dayIndex,
                            card
                        });
                    } else {
                        const group = dayGroups.get(key);
                        if (periodId === group.endPeriod + 1) {
                            group.endPeriod = periodId;
                        }
                    }
                }
            });
        });

        // Create events for each day group, respecting week visibility settings
        dayGroups.forEach((group) => {
            // Skip this event if the week type is hidden
            const weekType = group.weeks === '11' ? 'every' : 
                           group.weeks === '10' ? 'odd' : 
                           group.weeks === '01' ? 'even' : 'every';
            
            if ((weekType === 'odd' && !showOddWeeks) || 
                (weekType === 'even' && !showEvenWeeks)) {
                return; // Skip this event
            }
            // Get rooms from the card
            const roomIds = (group.card.getAttribute('classroomids') || '').split(',').filter(Boolean);
            const rooms = roomIds.map(id => mappings.rooms[id]?.name || 'Unknown');
            const roomDisplay = rooms.length > 2 ? 'Multiple Venues' : rooms.join(' & ');
            
            const classIds = (lesson.getAttribute('classids') || '').split(',').filter(Boolean);
            const classNames = classIds.length > 3 
                ? 'Multiple Classes'
                : classIds.map(id => mappings.classes[id]?.name || 'Unknown').join(', ');

            const eventDate = new Date(firstWeekDate);
            const startDayOfWeek = firstWeekDate.getDay();
            const targetDayIndex = group.dayIndex + 1;
            const daysToAdd = (targetDayIndex - startDayOfWeek + 7) % 7;
            eventDate.setDate(firstWeekDate.getDate() + daysToAdd);

            const isNextWeek = daysToAdd >= (7 - startDayOfWeek);
            const computedType = computeWeekTypeFromDate(eventDate);
            const targetType = group.weeks === '11' ? 'every' : (group.weeks === '10' ? 'odd' : 'even');
            const shouldStartNextWeek = targetType !== 'every' && computedType !== targetType;

            // Calculate event times
            const startHour = Math.floor((group.startPeriod - 1) / 2) + 7;
            const startMinute = ((group.startPeriod - 1) % 2) * 30 + 30;
            const startTime = new Date(eventDate);
            startTime.setHours(startHour, startMinute, 0);

            const totalMinutes = ((group.endPeriod - 1) % 2) * 30 + 60;
            const endHour = Math.floor((group.endPeriod - 1) / 2) + 7;
            const endTime = new Date(eventDate);
            endTime.setHours(endHour + Math.floor(totalMinutes / 60), totalMinutes % 60, 0);

            if (shouldStartNextWeek) {
                startTime.setDate(startTime.getDate() + 7);
                endTime.setDate(endTime.getDate() + 7);
            }

            const vevent = new ICAL.Component('vevent');
            vevent.addPropertyWithValue('summary', `${subject.name} (${classNames})`);
            vevent.addPropertyWithValue('dtstart', ICAL.Time.fromJSDate(startTime))
                .setParameter('tzid', 'Asia/Singapore');
            vevent.addPropertyWithValue('dtend', ICAL.Time.fromJSDate(endTime))
                .setParameter('tzid', 'Asia/Singapore');
            vevent.addPropertyWithValue('dtstamp', ICAL.Time.fromJSDate(new Date()));
            vevent.addPropertyWithValue('location', roomDisplay);
            vevent.addPropertyWithValue('description', classNames);
            vevent.addPropertyWithValue('status', 'CONFIRMED');
            const uidValue = `${lessonId}-${group.dayIndex}-${group.weeks}-${group.startPeriod}-${group.endPeriod}-${roomIds.join('_')}`;
            vevent.addPropertyWithValue('uid', uidValue);

            const untilDate = new Date(endDate);
            untilDate.setHours(23, 59, 59);

            // Update the recurrence rule based on week pattern
            const recur = new ICAL.Recur({
                freq: 'WEEKLY',
                interval: weeksdefId === '4CEEF5CAAC1CEE35' ? 1 : 2,  // Use interval 1 for every week
                byday: [['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][targetDayIndex]],
                until: ICAL.Time.fromJSDate(untilDate)
            });

            vevent.addPropertyWithValue('rrule', recur);
            cal.addSubcomponent(vevent);
        });
    });

    return cal;
}

function createEventForCard(calendar, card, lesson, weekStart) {
    const subjectId = lesson.getAttribute('subjectid');
    const roomId = lesson.getAttribute('classroomids').split(',')[0];
    const periodId = card.getAttribute('period');
    const daysdefid = lesson.getAttribute('daysdefid');

    const subject = mappings.subjects[subjectId];
    const room = mappings.rooms[roomId];
    const period = mappings.periods[periodId];
    const daysPattern = mappings.daysdef[daysdefid]?.days || '10000';
    
    const dayOffset = daysPattern.indexOf('1');
    const eventDate = new Date(weekStart);
    eventDate.setDate(weekStart.getDate() + dayOffset);

    const [startHour, startMin] = period.start.split(':');
    const [endHour, endMin] = period.end.split(':');

    const startTime = new Date(eventDate);
    startTime.setHours(parseInt(startHour), parseInt(startMin), 0);

    const endTime = new Date(eventDate);
    endTime.setHours(parseInt(endHour), parseInt(endMin), 0);

    const vevent = new ICAL.Component('vevent');
    vevent.updatePropertyWithValue('summary', `${subject.name} (${subject.short})`);
    vevent.updatePropertyWithValue('location', room.name);
    vevent.updatePropertyWithValue('dtstart', ICAL.Time.fromJSDate(startTime));
    vevent.updatePropertyWithValue('dtend', ICAL.Time.fromJSDate(endTime));
    vevent.updatePropertyWithValue('uid', Math.random().toString(36).substring(2));

    calendar.addSubcomponent(vevent);
}

window.downloadICS = function(calendar, teacherShort) {
    const blob = new Blob([calendar.toString()], { type: 'text/calendar' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timetable_${teacherShort.replace(/[\[\]]/g, '')}.ics`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

function updatePreview(teacherId) {
    const previewSection = document.getElementById('previewSection');
    if (!previewSection) return;

    let tablesContainer = document.getElementById('timetableTables');
    if (!tablesContainer) {
        tablesContainer = document.createElement('div');
        tablesContainer.id = 'timetableTables';
        previewSection.appendChild(tablesContainer);
    }
    
    // Update only the tables container with odd/even week tables based on configuration
    let tablesHTML = '<div class="timetable-container">';
    
    if (showOddWeeks) {
        tablesHTML += `
            <div class="week-table">
                <h3 class="week-header">Odd Week</h3>
                <table id="oddWeekTable" class="preview-table">
                    <thead>
                        <tr>
                            <th>Day</th>
                            <th>Time</th>
                            <th>Subject</th>
                            <th>Room</th>
                            <th>Week Type</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>`;
    }
    
    if (showEvenWeeks) {
        tablesHTML += `
            <div class="week-table">
                <h3 class="week-header">Even Week</h3>
                <table id="evenWeekTable" class="preview-table">
                    <thead>
                        <tr>
                            <th>Day</th>
                            <th>Time</th>
                            <th>Subject</th>
                            <th>Room</th>
                            <th>Week Type</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>`;
    }
    
    tablesHTML += '</div>';
    tablesContainer.innerHTML = tablesHTML;

    const oddWeekTable = showOddWeeks ? document.getElementById('oddWeekTable').getElementsByTagName('tbody')[0] : null;
    const evenWeekTable = showEvenWeeks ? document.getElementById('evenWeekTable').getElementsByTagName('tbody')[0] : null;
    const lessons = xmlData.querySelectorAll(`lesson[teacherids*="${teacherId}"]`);
    const lessonMap = new Map();
    
    lessons.forEach(lesson => {
        const lessonId = lesson.getAttribute('id');
        const subjectId = lesson.getAttribute('subjectid');
        const subject = mappings.subjects[subjectId] || { name: 'Unknown', short: 'Unknown' };
        const weeksdefId = lesson.getAttribute('weeksdefid');
        
        if (subject.name.includes('HBL') || subject.name.includes('Home Based Learning')) {
            return;
        }

        const cards = xmlData.querySelectorAll(`card[lessonid="${lessonId}"]`);
        const dayGroups = new Map();
        
        cards.forEach(card => {
            const daysPattern = card.getAttribute('days');
            const periodId = parseInt(card.getAttribute('period'));
            const roomIds = (card.getAttribute('classroomids') || '').split(',').filter(Boolean);
            const rooms = roomIds.map(id => mappings.rooms[id]?.name || 'Unknown');
            const roomDisplay = rooms.length > 2 ? 'Multiple Venues' : rooms.join(' & ');
            
            let weekPatterns;
            if (weeksdefId === '4CEEF5CAAC1CEE35') {
                weekPatterns = ['11'];
            } else if (weeksdefId === 'F20BB99A3CE4D221') {
                weekPatterns = ['01'];
            } else if (weeksdefId === '1DE69DF37257B010') {
                weekPatterns = ['10'];
            } else {
                weekPatterns = [card.getAttribute('weeks')];
            }
            
            weekPatterns.forEach(weeks => {
                for (let dayIndex = 0; dayIndex < daysPattern.length; dayIndex++) {
                    if (daysPattern[dayIndex] !== '1') continue;
                    
                    const key = `${dayIndex}-${weeks}-${roomDisplay}`;
                    if (!dayGroups.has(key)) {
                        dayGroups.set(key, {
                            startPeriod: periodId,
                            endPeriod: periodId,
                            weeks,
                            dayIndex,
                            room: roomDisplay,
                            subject: subject.name,
                            className: classNames
                        });
                    } else {
                        const group = dayGroups.get(key);
                        if (periodId === group.endPeriod + 1) {
                            group.endPeriod = periodId;
                        }
                    }
                }
            });
        });

        dayGroups.forEach((group, key) => {
            const startPeriodInfo = mappings.periods[group.startPeriod];
            const endPeriodInfo = mappings.periods[group.endPeriod];
            
            const weekType = group.weeks === '11' ? 'Every Week' : 
                           group.weeks === '10' ? 'Odd Week' : 
                           group.weeks === '01' ? 'Even Week' : 'Every Week';
            
            lessonMap.set(key, {
                day: group.dayIndex,
                startTime: startPeriodInfo?.start || '07:30',
                endTime: endPeriodInfo?.end || '08:00',
                subject: group.subject,
                className: group.className,
                room: group.room,
                weekType: weekType,
                isOddWeek: weekType === 'Odd Week',
                startPeriod: group.startPeriod
            });
        });
    });

    const lessonEntries = Array.from(lessonMap.values()).sort((a, b) => {
        if (a.day !== b.day) return a.day - b.day;
        return a.startPeriod - b.startPeriod;
    });

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    
    // Create row HTML for a lesson entry
    const createRow = entry => `
        <tr>
            <td>${days[entry.day]}</td>
            <td>${entry.startTime} - ${entry.endTime}</td>
            <td>${entry.subject}${entry.className ? ` (${entry.className})` : ''}</td>
            <td>${entry.room}</td>
            <td>${entry.weekType}</td>
        </tr>
    `;

    // Filter and display lessons for each week
    const oddWeekLessons = lessonEntries.filter(entry => 
        entry.weekType === 'Odd Week' || entry.weekType === 'Every Week'
    );
    const evenWeekLessons = lessonEntries.filter(entry => 
        entry.weekType === 'Even Week' || entry.weekType === 'Every Week'
    );

    if (oddWeekTable) {
        oddWeekTable.innerHTML = oddWeekLessons.length ? 
            oddWeekLessons.map(createRow).join('') : 
            '<tr><td colspan="5">No lessons found for this week</td></tr>';
    }

    if (evenWeekTable) {
        evenWeekTable.innerHTML = evenWeekLessons.length ? 
            evenWeekLessons.map(createRow).join('') : 
            '<tr><td colspan="5">No lessons found for this week</td></tr>';
    }
}

function createTeacherCalendar(teacherId, startDate, endDate, startWeekType) {
    const cal = new ICAL.Component(['vcalendar', [], []]);
    cal.updatePropertyWithValue('prodid', '-//Timetable Calendar//EN');
    cal.updatePropertyWithValue('version', '2.0');
    cal.updatePropertyWithValue('calscale', 'GREGORIAN');

    const lessons = xmlData.querySelectorAll(`lesson[teacherids*="${teacherId}"]`);
    console.log(`Found ${lessons.length} total lessons for teacher ${teacherId}`);
    
    const firstWeekDate = new Date(startDate);
    
    lessons.forEach(lesson => {
        const lessonId = lesson.getAttribute('id');
        const subjectId = lesson.getAttribute('subjectid');
        const subject = mappings.subjects[subjectId] || { name: 'Unknown', short: 'Unknown' };
        const weeksdefId = lesson.getAttribute('weeksdefid');
        
        if (subject.name.includes('HBL') || subject.name.includes('Home Based Learning')) {
            return;
        }

        const cards = xmlData.querySelectorAll(`card[lessonid="${lessonId}"]`);
        const dayGroups = new Map();
        
        cards.forEach(card => {
            const daysPattern = card.getAttribute('days');
            const periodId = parseInt(card.getAttribute('period'));
            
            // Update week pattern handling
            let weekPatterns;
            if (weeksdefId === '4CEEF5CAAC1CEE35') {
                // For every week lessons, use interval: 1 instead of patterns
                weekPatterns = ['11'];
            } else if (weeksdefId === 'F20BB99A3CE4D221') {
                weekPatterns = ['01'];
            } else if (weeksdefId === '1DE69DF37257B010') {
                weekPatterns = ['10'];
            } else {
                weekPatterns = [card.getAttribute('weeks')];
            }
            
            weekPatterns.forEach(weeks => {
                for (let dayIndex = 0; dayIndex < daysPattern.length; dayIndex++) {
                    if (daysPattern[dayIndex] !== '1') continue;
                    
                    const key = `${dayIndex}-${weeks}`;
                    if (!dayGroups.has(key)) {
                        dayGroups.set(key, {
                            startPeriod: periodId,
                            endPeriod: periodId,
                            weeks,
                            dayIndex,
                            card
                        });
                    } else {
                        const group = dayGroups.get(key);
                        if (periodId === group.endPeriod + 1) {
                            group.endPeriod = periodId;
                        }
                    }
                }
            });
        });

        // Create events for each day group, respecting week visibility settings
        dayGroups.forEach((group) => {
            // Skip this event if the week type is hidden
            const weekType = group.weeks === '11' ? 'every' : 
                           group.weeks === '10' ? 'odd' : 
                           group.weeks === '01' ? 'even' : 'every';
            
            if ((weekType === 'odd' && !showOddWeeks) || 
                (weekType === 'even' && !showEvenWeeks)) {
                return; // Skip this event
            }
            // Get rooms from the card
            const roomIds = (group.card.getAttribute('classroomids') || '').split(',').filter(Boolean);
            const rooms = roomIds.map(id => mappings.rooms[id]?.name || 'Unknown');
            const roomDisplay = rooms.length > 2 ? 'Multiple Venues' : rooms.join(' & ');
            
            const classIds = (lesson.getAttribute('classids') || '').split(',').filter(Boolean);
            const classNames = classIds.length > 3 
                ? 'Multiple Classes'
                : classIds.map(id => mappings.classes[id]?.name || 'Unknown').join(', ');

            const eventDate = new Date(firstWeekDate);
            const startDayOfWeek = firstWeekDate.getDay();
            const targetDayIndex = group.dayIndex + 1;
            const daysToAdd = (targetDayIndex - startDayOfWeek + 7) % 7;
            eventDate.setDate(firstWeekDate.getDate() + daysToAdd);

            const isNextWeek = daysToAdd >= (7 - startDayOfWeek);
            const shouldStartNextWeek = 
                (startWeekType === 'even' && group.weeks === '10' && !isNextWeek) || 
                (startWeekType === 'odd' && group.weeks === '01' && !isNextWeek) ||
                (startWeekType === 'even' && group.weeks === '01' && isNextWeek) ||
                (startWeekType === 'odd' && group.weeks === '10' && isNextWeek);

            // Calculate event times
            const startHour = Math.floor((group.startPeriod - 1) / 2) + 7;
            const startMinute = ((group.startPeriod - 1) % 2) * 30 + 30;
            const startTime = new Date(eventDate);
            startTime.setHours(startHour, startMinute, 0);

            const totalMinutes = ((group.endPeriod - 1) % 2) * 30 + 60;
            const endHour = Math.floor((group.endPeriod - 1) / 2) + 7;
            const endTime = new Date(eventDate);
            endTime.setHours(endHour + Math.floor(totalMinutes / 60), totalMinutes % 60, 0);

            if (shouldStartNextWeek) {
                startTime.setDate(startTime.getDate() + 7);
                endTime.setDate(endTime.getDate() + 7);
            }

            const vevent = new ICAL.Component('vevent');
            vevent.addPropertyWithValue('summary', `${subject.name} (${classNames})`);
            vevent.addPropertyWithValue('dtstart', ICAL.Time.fromJSDate(startTime))
                .setParameter('tzid', 'Asia/Singapore');
            vevent.addPropertyWithValue('dtend', ICAL.Time.fromJSDate(endTime))
                .setParameter('tzid', 'Asia/Singapore');
            vevent.addPropertyWithValue('location', roomDisplay);
            vevent.addPropertyWithValue('description', classNames);
            vevent.addPropertyWithValue('status', 'CONFIRMED');
            vevent.addPropertyWithValue('uid', `${lessonId}-${group.dayIndex}-${group.weeks}`);

            const untilDate = new Date(endDate);
            untilDate.setHours(23, 59, 59);

            // Update the recurrence rule based on week pattern
            const recur = new ICAL.Recur({
                freq: 'WEEKLY',
                interval: weeksdefId === '4CEEF5CAAC1CEE35' ? 1 : 2,  // Use interval 1 for every week
                byday: [['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][targetDayIndex]],
                until: ICAL.Time.fromJSDate(untilDate)
            });

            vevent.addPropertyWithValue('rrule', recur);
            cal.addSubcomponent(vevent);
        });
    });

    return cal;
}

function createEventForCard(calendar, card, lesson, weekStart) {
    const subjectId = lesson.getAttribute('subjectid');
    const roomId = lesson.getAttribute('classroomids').split(',')[0];
    const periodId = card.getAttribute('period');
    const daysdefid = lesson.getAttribute('daysdefid');

    const subject = mappings.subjects[subjectId];
    const room = mappings.rooms[roomId];
    const period = mappings.periods[periodId];
    const daysPattern = mappings.daysdef[daysdefid]?.days || '10000';
    
    const dayOffset = daysPattern.indexOf('1');
    const eventDate = new Date(weekStart);
    eventDate.setDate(weekStart.getDate() + dayOffset);

    const [startHour, startMin] = period.start.split(':');
    const [endHour, endMin] = period.end.split(':');

    const startTime = new Date(eventDate);
    startTime.setHours(parseInt(startHour), parseInt(startMin), 0);

    const endTime = new Date(eventDate);
    endTime.setHours(parseInt(endHour), parseInt(endMin), 0);

    const vevent = new ICAL.Component('vevent');
    vevent.updatePropertyWithValue('summary', `${subject.name} (${subject.short})`);
    vevent.updatePropertyWithValue('location', room.name);
    vevent.updatePropertyWithValue('dtstart', ICAL.Time.fromJSDate(startTime));
    vevent.updatePropertyWithValue('dtend', ICAL.Time.fromJSDate(endTime));
    vevent.updatePropertyWithValue('uid', Math.random().toString(36).substring(2));

    calendar.addSubcomponent(vevent);
}

function downloadICS(calendar, teacherShort) {
    const blob = new Blob([calendar.toString()], { type: 'text/calendar' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timetable_${teacherShort.replace(/[\[\]]/g, '')}.ics`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

function updatePreview(teacherId) {
    const previewSection = document.getElementById('previewSection');
    if (!previewSection) return;

    let tablesContainer = document.getElementById('timetableTables');
    if (!tablesContainer) {
        tablesContainer = document.createElement('div');
        tablesContainer.id = 'timetableTables';
        previewSection.appendChild(tablesContainer);
    }
    
    // Update only the tables container with odd/even week tables based on configuration
    let tablesHTML = '<div class="timetable-container">';
    
    if (showOddWeeks) {
        tablesHTML += `
            <div class="week-table">
                <h3 class="week-header">Odd Week</h3>
                <table id="oddWeekTable" class="preview-table">
                    <thead>
                        <tr>
                            <th>Day</th>
                            <th>Time</th>
                            <th>Subject</th>
                            <th>Room</th>
                            <th>Week Type</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>`;
    }
    
    if (showEvenWeeks) {
        tablesHTML += `
            <div class="week-table">
                <h3 class="week-header">Even Week</h3>
                <table id="evenWeekTable" class="preview-table">
                    <thead>
                        <tr>
                            <th>Day</th>
                            <th>Time</th>
                            <th>Subject</th>
                            <th>Room</th>
                            <th>Week Type</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>`;
    }
    
    tablesHTML += '</div>';
    tablesContainer.innerHTML = tablesHTML;

    const oddWeekTable = showOddWeeks ? document.getElementById('oddWeekTable').getElementsByTagName('tbody')[0] : null;
    const evenWeekTable = showEvenWeeks ? document.getElementById('evenWeekTable').getElementsByTagName('tbody')[0] : null;
    const lessons = xmlData.querySelectorAll(`lesson[teacherids*="${teacherId}"]`);
    const lessonMap = new Map();
    
    lessons.forEach(lesson => {
        const lessonId = lesson.getAttribute('id');
        const subjectId = lesson.getAttribute('subjectid');
        const subject = mappings.subjects[subjectId] || { name: 'Unknown', short: 'Unknown' };
        const weeksdefId = lesson.getAttribute('weeksdefid');
        
        if (subject.name.includes('HBL') || subject.name.includes('Home Based Learning')) {
            return;
        }

        const cards = xmlData.querySelectorAll(`card[lessonid="${lessonId}"]`);
        const dayGroups = new Map();
        
        cards.forEach(card => {
            const daysPattern = card.getAttribute('days');
            const periodId = parseInt(card.getAttribute('period'));
            const roomIds = (card.getAttribute('classroomids') || '').split(',').filter(Boolean);
            const rooms = roomIds.map(id => mappings.rooms[id]?.name || 'Unknown');
            const roomDisplay = rooms.length > 2 ? 'Multiple Venues' : rooms.join(' & ');
            
            let weekPatterns;
            if (weeksdefId === '4CEEF5CAAC1CEE35') {
                weekPatterns = ['11'];
            } else if (weeksdefId === 'F20BB99A3CE4D221') {
                weekPatterns = ['01'];
            } else if (weeksdefId === '1DE69DF37257B010') {
                weekPatterns = ['10'];
            } else {
                weekPatterns = [card.getAttribute('weeks')];
            }
            
            weekPatterns.forEach(weeks => {
                for (let dayIndex = 0; dayIndex < daysPattern.length; dayIndex++) {
                    if (daysPattern[dayIndex] !== '1') continue;
                    
                    const key = `${dayIndex}-${weeks}-${roomDisplay}`;
                    if (!dayGroups.has(key)) {
                        dayGroups.set(key, {
                            startPeriod: periodId,
                            endPeriod: periodId,
                            weeks,
                            dayIndex,
                            room: roomDisplay,
                            subject: subject.name,
                            className: classNames
                        });
                    } else {
                        const group = dayGroups.get(key);
                        if (periodId === group.endPeriod + 1) {
                            group.endPeriod = periodId;
                        }
                    }
                }
            });
        });

        dayGroups.forEach((group, key) => {
            const startPeriodInfo = mappings.periods[group.startPeriod];
            const endPeriodInfo = mappings.periods[group.endPeriod];
            
            const weekType = group.weeks === '11' ? 'Every Week' : 
                           group.weeks === '10' ? 'Odd Week' : 
                           group.weeks === '01' ? 'Even Week' : 'Every Week';
            
            lessonMap.set(key, {
                day: group.dayIndex,
                startTime: startPeriodInfo?.start || '07:30',
                endTime: endPeriodInfo?.end || '08:00',
                subject: group.subject,
                className: group.className,
                room: group.room,
                weekType: weekType,
                isOddWeek: weekType === 'Odd Week',
                startPeriod: group.startPeriod
            });
        });
    });

    const lessonEntries = Array.from(lessonMap.values()).sort((a, b) => {
        if (a.day !== b.day) return a.day - b.day;
        return a.startPeriod - b.startPeriod;
    });

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    
    // Create row HTML for a lesson entry
    const createRow = entry => `
        <tr>
            <td>${days[entry.day]}</td>
            <td>${entry.startTime} - ${entry.endTime}</td>
            <td>${entry.subject}${entry.className ? ` (${entry.className})` : ''}</td>
            <td>${entry.room}</td>
            <td>${entry.weekType}</td>
        </tr>
    `;

    // Filter and display lessons for each week
    const oddWeekLessons = lessonEntries.filter(entry => 
        entry.weekType === 'Odd Week' || entry.weekType === 'Every Week'
    );
    const evenWeekLessons = lessonEntries.filter(entry => 
        entry.weekType === 'Even Week' || entry.weekType === 'Every Week'
    );

    if (oddWeekTable) {
        oddWeekTable.innerHTML = oddWeekLessons.length ? 
            oddWeekLessons.map(createRow).join('') : 
            '<tr><td colspan="5">No lessons found for this week</td></tr>';
    }

    if (evenWeekTable) {
        evenWeekTable.innerHTML = evenWeekLessons.length ? 
            evenWeekLessons.map(createRow).join('') : 
            '<tr><td colspan="5">No lessons found for this week</td></tr>';
    }
}

function createTeacherCalendar(teacherId, startDate, endDate, startWeekType) {
    const cal = new ICAL.Component(['vcalendar', [], []]);
    cal.updatePropertyWithValue('prodid', '-//Timetable Calendar//EN');
    cal.updatePropertyWithValue('version', '2.0');
    cal.updatePropertyWithValue('calscale', 'GREGORIAN');

    const lessons = xmlData.querySelectorAll(`lesson[teacherids*="${teacherId}"]`);
    console.log(`Found ${lessons.length} total lessons for teacher ${teacherId}`);
    
    const firstWeekDate = new Date(startDate);
    
    lessons.forEach(lesson => {
        const lessonId = lesson.getAttribute('id');
        const subjectId = lesson.getAttribute('subjectid');
        const subject = mappings.subjects[subjectId] || { name: 'Unknown', short: 'Unknown' };
        const weeksdefId = lesson.getAttribute('weeksdefid');
        
        if (subject.name.includes('HBL') || subject.name.includes('Home Based Learning')) {
            return;
        }

        const cards = xmlData.querySelectorAll(`card[lessonid="${lessonId}"]`);
        const dayGroups = new Map();
        
        cards.forEach(card => {
            const daysPattern = card.getAttribute('days');
            const periodId = parseInt(card.getAttribute('period'));
            
            // Update week pattern handling
            let weekPatterns;
            if (weeksdefId === '4CEEF5CAAC1CEE35') {
                // For every week lessons, use interval: 1 instead of patterns
                weekPatterns = ['11'];
            } else if (weeksdefId === 'F20BB99A3CE4D221') {
                weekPatterns = ['01'];
            } else if (weeksdefId === '1DE69DF37257B010') {
                weekPatterns = ['10'];
            } else {
                weekPatterns = [card.getAttribute('weeks')];
            }
            
            weekPatterns.forEach(weeks => {
                for (let dayIndex = 0; dayIndex < daysPattern.length; dayIndex++) {
                    if (daysPattern[dayIndex] !== '1') continue;
                    
                    const key = `${dayIndex}-${weeks}`;
                    if (!dayGroups.has(key)) {
                        dayGroups.set(key, {
                            startPeriod: periodId,
                            endPeriod: periodId,
                            weeks,
                            dayIndex,
                            card
                        });
                    } else {
                        const group = dayGroups.get(key);
                        if (periodId === group.endPeriod + 1) {
                            group.endPeriod = periodId;
                        }
                    }
                }
            });
        });

        // Create events for each day group, respecting week visibility settings
        dayGroups.forEach((group) => {
            // Skip this event if the week type is hidden
            const weekType = group.weeks === '11' ? 'every' : 
                           group.weeks === '10' ? 'odd' : 
                           group.weeks === '01' ? 'even' : 'every';
            
            if ((weekType === 'odd' && !showOddWeeks) || 
                (weekType === 'even' && !showEvenWeeks)) {
                return; // Skip this event
            }
            // Get rooms from the card
            const roomIds = (group.card.getAttribute('classroomids') || '').split(',').filter(Boolean);
            const rooms = roomIds.map(id => mappings.rooms[id]?.name || 'Unknown');
            const roomDisplay = rooms.length > 2 ? 'Multiple Venues' : rooms.join(' & ');
            
            const classIds = (lesson.getAttribute('classids') || '').split(',').filter(Boolean);
            const classNames = classIds.length > 3 
                ? 'Multiple Classes'
                : classIds.map(id => mappings.classes[id]?.name || 'Unknown').join(', ');

            const eventDate = new Date(firstWeekDate);
            const startDayOfWeek = firstWeekDate.getDay();
            const targetDayIndex = group.dayIndex + 1;
            const daysToAdd = (targetDayIndex - startDayOfWeek + 7) % 7;
            eventDate.setDate(firstWeekDate.getDate() + daysToAdd);

            const isNextWeek = daysToAdd >= (7 - startDayOfWeek);
            const shouldStartNextWeek = 
                (startWeekType === 'even' && group.weeks === '10' && !isNextWeek) || 
                (startWeekType === 'odd' && group.weeks === '01' && !isNextWeek) ||
                (startWeekType === 'even' && group.weeks === '01' && isNextWeek) ||
                (startWeekType === 'odd' && group.weeks === '10' && isNextWeek);

            // Calculate event times
            const startHour = Math.floor((group.startPeriod - 1) / 2) + 7;
            const startMinute = ((group.startPeriod - 1) % 2) * 30 + 30;
            const startTime = new Date(eventDate);
            startTime.setHours(startHour, startMinute, 0);

            const totalMinutes = ((group.endPeriod - 1) % 2) * 30 + 60;
            const endHour = Math.floor((group.endPeriod - 1) / 2) + 7;
            const endTime = new Date(eventDate);
            endTime.setHours(endHour + Math.floor(totalMinutes / 60), totalMinutes % 60, 0);

            if (shouldStartNextWeek) {
                startTime.setDate(startTime.getDate() + 7);
                endTime.setDate(endTime.getDate() + 7);
            }

            const vevent = new ICAL.Component('vevent');
            vevent.addPropertyWithValue('summary', `${subject.name} (${classNames})`);
            vevent.addPropertyWithValue('dtstart', ICAL.Time.fromJSDate(startTime))
                .setParameter('tzid', 'Asia/Singapore');
            vevent.addPropertyWithValue('dtend', ICAL.Time.fromJSDate(endTime))
                .setParameter('tzid', 'Asia/Singapore');
            vevent.addPropertyWithValue('location', roomDisplay);
            vevent.addPropertyWithValue('description', classNames);
            vevent.addPropertyWithValue('status', 'CONFIRMED');
            vevent.addPropertyWithValue('uid', `${lessonId}-${group.dayIndex}-${group.weeks}`);

            const untilDate = new Date(endDate);
            untilDate.setHours(23, 59, 59);

            // Update the recurrence rule based on week pattern
            const recur = new ICAL.Recur({
                freq: 'WEEKLY',
                interval: weeksdefId === '4CEEF5CAAC1CEE35' ? 1 : 2,  // Use interval 1 for every week
                byday: [['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][targetDayIndex]],
                until: ICAL.Time.fromJSDate(untilDate)
            });

            vevent.addPropertyWithValue('rrule', recur);
            cal.addSubcomponent(vevent);
        });
    });

    return cal;
}

function createEventForCard(calendar, card, lesson, weekStart) {
    const subjectId = lesson.getAttribute('subjectid');
    const roomId = lesson.getAttribute('classroomids').split(',')[0];
    const periodId = card.getAttribute('period');
    const daysdefid = lesson.getAttribute('daysdefid');

    const subject = mappings.subjects[subjectId];
    const room = mappings.rooms[roomId];
    const period = mappings.periods[periodId];
    const daysPattern = mappings.daysdef[daysdefid]?.days || '10000';
    
    const dayOffset = daysPattern.indexOf('1');
    const eventDate = new Date(weekStart);
    eventDate.setDate(weekStart.getDate() + dayOffset);

    const [startHour, startMin] = period.start.split(':');
    const [endHour, endMin] = period.end.split(':');

    const startTime = new Date(eventDate);
    startTime.setHours(parseInt(startHour), parseInt(startMin), 0);

    const endTime = new Date(eventDate);
    endTime.setHours(parseInt(endHour), parseInt(endMin), 0);

    const vevent = new ICAL.Component('vevent');
    vevent.updatePropertyWithValue('summary', `${subject.name} (${subject.short})`);
    vevent.updatePropertyWithValue('location', room.name);
    vevent.updatePropertyWithValue('dtstart', ICAL.Time.fromJSDate(startTime));
    vevent.updatePropertyWithValue('dtend', ICAL.Time.fromJSDate(endTime));
    vevent.updatePropertyWithValue('uid', Math.random().toString(36).substring(2));

    calendar.addSubcomponent(vevent);
}

function downloadICS(calendar, teacherShort) {
    const blob = new Blob([calendar.toString()], { type: 'text/calendar' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timetable_${teacherShort.replace(/[\[\]]/g, '')}.ics`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

    // Update only the tables container with odd/even week tables based on configuration
    let tablesHTML = '<div class="timetable-container">';
    
    if (showOddWeeks) {
        tablesHTML += `
            <div class="week-table">
                <h3 class="week-header">Odd Week</h3>
                <table id="oddWeekTable" class="preview-table">
                    <thead>
                        <tr>
                            <th>Day</th>
                            <th>Time</th>
                            <th>Subject</th>
                            <th>Room</th>
                            <th>Week Type</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>`;
    }
    
    if (showEvenWeeks) {
        tablesHTML += `
            <div class="week-table">
                <h3 class="week-header">Even Week</h3>
                <table id="evenWeekTable" class="preview-table">
                    <thead>
                        <tr>
                            <th>Day</th>
                            <th>Time</th>
                            <th>Subject</th>
                            <th>Room</th>
                            <th>Week Type</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>`;
    }
    
    tablesHTML += '</div>';
    tablesContainer.innerHTML = tablesHTML;

    const oddWeekTable = showOddWeeks ? document.getElementById('oddWeekTable').getElementsByTagName('tbody')[0] : null;
    const evenWeekTable = showEvenWeeks ? document.getElementById('evenWeekTable').getElementsByTagName('tbody')[0] : null;
    const lessons = xmlData.querySelectorAll(`lesson[teacherids*="${teacherId}"]`);
    const lessonMap = new Map();
    
    lessons.forEach(lesson => {
        const lessonId = lesson.getAttribute('id');
        const subjectId = lesson.getAttribute('subjectid');
        const subject = mappings.subjects[subjectId] || { name: 'Unknown', short: 'Unknown' };
        const weeksdefId = lesson.getAttribute('weeksdefid');
        
        if (subject.name.includes('HBL') || subject.name.includes('Home Based Learning')) {
            return;
        }

        const cards = xmlData.querySelectorAll(`card[lessonid="${lessonId}"]`);
        const dayGroups = new Map();
        
        cards.forEach(card => {
            const daysPattern = card.getAttribute('days');
            const periodId = parseInt(card.getAttribute('period'));
            const roomIds = (card.getAttribute('classroomids') || '').split(',').filter(Boolean);
            const rooms = roomIds.map(id => mappings.rooms[id]?.name || 'Unknown');
            const roomDisplay = rooms.length > 2 ? 'Multiple Venues' : rooms.join(' & ');
            
            let weekPatterns;
            if (weeksdefId === '4CEEF5CAAC1CEE35') {
                weekPatterns = ['11'];
            } else if (weeksdefId === 'F20BB99A3CE4D221') {
                weekPatterns = ['01'];
            } else if (weeksdefId === '1DE69DF37257B010') {
                weekPatterns = ['10'];
            } else {
                weekPatterns = [card.getAttribute('weeks')];
            }
            
            weekPatterns.forEach(weeks => {
                for (let dayIndex = 0; dayIndex < daysPattern.length; dayIndex++) {
                    if (daysPattern[dayIndex] !== '1') continue;
                    
                    const key = `${dayIndex}-${weeks}-${roomDisplay}`;
                    if (!dayGroups.has(key)) {
                        dayGroups.set(key, {
                            startPeriod: periodId,
                            endPeriod: periodId,
                            weeks,
                            dayIndex,
                            room: roomDisplay,
                            subject: subject.name,
                            className: classNames
                        });
                    } else {
                        const group = dayGroups.get(key);
                        if (periodId === group.endPeriod + 1) {
                            group.endPeriod = periodId;
                        }
                    }
                }
            });
        });

        dayGroups.forEach((group, key) => {
            const startPeriodInfo = mappings.periods[group.startPeriod];
            const endPeriodInfo = mappings.periods[group.endPeriod];
            
            const weekType = group.weeks === '11' ? 'Every Week' : 
                           group.weeks === '10' ? 'Odd Week' : 
                           group.weeks === '01' ? 'Even Week' : 'Every Week';
            
            lessonMap.set(key, {
                day: group.dayIndex,
                startTime: startPeriodInfo?.start || '07:30',
                endTime: endPeriodInfo?.end || '08:00',
                subject: group.subject,
                className: group.className,
                room: group.room,
                weekType: weekType,
                isOddWeek: weekType === 'Odd Week',
                startPeriod: group.startPeriod
            });
        });
    });

    const lessonEntries = Array.from(lessonMap.values()).sort((a, b) => {
        if (a.day !== b.day) return a.day - b.day;
        return a.startPeriod - b.startPeriod;
    });

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    
    // Create row HTML for a lesson entry
    const createRow = entry => `
        <tr>
            <td>${days[entry.day]}</td>
            <td>${entry.startTime} - ${entry.endTime}</td>
            <td>${entry.subject}${entry.className ? ` (${entry.className})` : ''}</td>
            <td>${entry.room}</td>
            <td>${entry.weekType}</td>
        </tr>
    `;

    // Filter and display lessons for each week
    const oddWeekLessons = lessonEntries.filter(entry => 
        entry.weekType === 'Odd Week' || entry.weekType === 'Every Week'
    );
    const evenWeekLessons = lessonEntries.filter(entry => 
        entry.weekType === 'Even Week' || entry.weekType === 'Every Week'
    );

    if (oddWeekTable) {
        oddWeekTable.innerHTML = oddWeekLessons.length ? 
            oddWeekLessons.map(createRow).join('') : 
            '<tr><td colspan="5">No lessons found for this week</td></tr>';
    }

    if (evenWeekTable) {
        evenWeekTable.innerHTML = evenWeekLessons.length ? 
            evenWeekLessons.map(createRow).join('') : 
            '<tr><td colspan="5">No lessons found for this week</td></tr>';
    }


function createTeacherCalendar(teacherId, startDate, endDate, startWeekType) {
    const cal = new ICAL.Component(['vcalendar', [], []]);
    cal.updatePropertyWithValue('prodid', '-//Timetable Calendar//EN');
    cal.updatePropertyWithValue('version', '2.0');
    cal.updatePropertyWithValue('calscale', 'GREGORIAN');

    const lessons = xmlData.querySelectorAll(`lesson[teacherids*="${teacherId}"]`);
    console.log(`Found ${lessons.length} total lessons for teacher ${teacherId}`);
    
    const firstWeekDate = new Date(startDate);
    
    lessons.forEach(lesson => {
        const lessonId = lesson.getAttribute('id');
        const subjectId = lesson.getAttribute('subjectid');
        const subject = mappings.subjects[subjectId] || { name: 'Unknown', short: 'Unknown' };
        const weeksdefId = lesson.getAttribute('weeksdefid');
        
        if (subject.name.includes('HBL') || subject.name.includes('Home Based Learning')) {
            return;
        }

        const cards = xmlData.querySelectorAll(`card[lessonid="${lessonId}"]`);
        const dayGroups = new Map();
        
        cards.forEach(card => {
            const daysPattern = card.getAttribute('days');
            const periodId = parseInt(card.getAttribute('period'));
            
            // Update week pattern handling
            let weekPatterns;
            if (weeksdefId === '4CEEF5CAAC1CEE35') {
                // For every week lessons, use interval: 1 instead of patterns
                weekPatterns = ['11'];
            } else if (weeksdefId === 'F20BB99A3CE4D221') {
                weekPatterns = ['01'];
            } else if (weeksdefId === '1DE69DF37257B010') {
                weekPatterns = ['10'];
            } else {
                weekPatterns = [card.getAttribute('weeks')];
            }
            
            weekPatterns.forEach(weeks => {
                for (let dayIndex = 0; dayIndex < daysPattern.length; dayIndex++) {
                    if (daysPattern[dayIndex] !== '1') continue;
                    
                    const key = `${dayIndex}-${weeks}`;
                    if (!dayGroups.has(key)) {
                        dayGroups.set(key, {
                            startPeriod: periodId,
                            endPeriod: periodId,
                            weeks,
                            dayIndex,
                            card
                        });
                    } else {
                        const group = dayGroups.get(key);
                        if (periodId === group.endPeriod + 1) {
                            group.endPeriod = periodId;
                        }
                    }
                }
            });
        });

        // Create events for each day group, respecting week visibility settings
        dayGroups.forEach((group) => {
            // Skip this event if the week type is hidden
            const weekType = group.weeks === '11' ? 'every' : 
                           group.weeks === '10' ? 'odd' : 
                           group.weeks === '01' ? 'even' : 'every';
            
            if ((weekType === 'odd' && !showOddWeeks) || 
                (weekType === 'even' && !showEvenWeeks)) {
                return; // Skip this event
            }
            // Get rooms from the card
            const roomIds = (group.card.getAttribute('classroomids') || '').split(',').filter(Boolean);
            const rooms = roomIds.map(id => mappings.rooms[id]?.name || 'Unknown');
            const roomDisplay = rooms.length > 2 ? 'Multiple Venues' : rooms.join(' & ');
            
            const classIds = (lesson.getAttribute('classids') || '').split(',').filter(Boolean);
            const classNames = classIds.length > 3 
                ? 'Multiple Classes'
                : classIds.map(id => mappings.classes[id]?.name || 'Unknown').join(', ');

            const eventDate = new Date(firstWeekDate);
            const startDayOfWeek = firstWeekDate.getDay();
            const targetDayIndex = group.dayIndex + 1;
            const daysToAdd = (targetDayIndex - startDayOfWeek + 7) % 7;
            eventDate.setDate(firstWeekDate.getDate() + daysToAdd);

            const isNextWeek = daysToAdd >= (7 - startDayOfWeek);
            const shouldStartNextWeek = 
                (startWeekType === 'even' && group.weeks === '10' && !isNextWeek) || 
                (startWeekType === 'odd' && group.weeks === '01' && !isNextWeek) ||
                (startWeekType === 'even' && group.weeks === '01' && isNextWeek) ||
                (startWeekType === 'odd' && group.weeks === '10' && isNextWeek);

            // Calculate event times
            const startHour = Math.floor((group.startPeriod - 1) / 2) + 7;
            const startMinute = ((group.startPeriod - 1) % 2) * 30 + 30;
            const startTime = new Date(eventDate);
            startTime.setHours(startHour, startMinute, 0);

            const totalMinutes = ((group.endPeriod - 1) % 2) * 30 + 60;
            const endHour = Math.floor((group.endPeriod - 1) / 2) + 7;
            const endTime = new Date(eventDate);
            endTime.setHours(endHour + Math.floor(totalMinutes / 60), totalMinutes % 60, 0);

            if (shouldStartNextWeek) {
                startTime.setDate(startTime.getDate() + 7);
                endTime.setDate(endTime.getDate() + 7);
            }

            const vevent = new ICAL.Component('vevent');
            vevent.addPropertyWithValue('summary', `${subject.name} (${classNames})`);
            vevent.addPropertyWithValue('dtstart', ICAL.Time.fromJSDate(startTime))
                .setParameter('tzid', 'Asia/Singapore');
            vevent.addPropertyWithValue('dtend', ICAL.Time.fromJSDate(endTime))
                .setParameter('tzid', 'Asia/Singapore');
            vevent.addPropertyWithValue('location', roomDisplay);
            vevent.addPropertyWithValue('description', classNames);
            vevent.addPropertyWithValue('status', 'CONFIRMED');
            vevent.addPropertyWithValue('uid', `${lessonId}-${group.dayIndex}-${group.weeks}`);

            const untilDate = new Date(endDate);
            untilDate.setHours(23, 59, 59);

            // Update the recurrence rule based on week pattern
            const recur = new ICAL.Recur({
                freq: 'WEEKLY',
                interval: weeksdefId === '4CEEF5CAAC1CEE35' ? 1 : 2,  // Use interval 1 for every week
                byday: [['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][targetDayIndex]],
                until: ICAL.Time.fromJSDate(untilDate)
            });

            vevent.addPropertyWithValue('rrule', recur);
            cal.addSubcomponent(vevent);
        });
    });

    return cal;
}

function createEventForCard(calendar, card, lesson, weekStart) {
    const subjectId = lesson.getAttribute('subjectid');
    const roomId = lesson.getAttribute('classroomids').split(',')[0];
    const periodId = card.getAttribute('period');
    const daysdefid = lesson.getAttribute('daysdefid');

    const subject = mappings.subjects[subjectId];
    const room = mappings.rooms[roomId];
    const period = mappings.periods[periodId];
    const daysPattern = mappings.daysdef[daysdefid]?.days || '10000';
    
    const dayOffset = daysPattern.indexOf('1');
    const eventDate = new Date(weekStart);
    eventDate.setDate(weekStart.getDate() + dayOffset);

    const [startHour, startMin] = period.start.split(':');
    const [endHour, endMin] = period.end.split(':');

    const startTime = new Date(eventDate);
    startTime.setHours(parseInt(startHour), parseInt(startMin), 0);

    const endTime = new Date(eventDate);
    endTime.setHours(parseInt(endHour), parseInt(endMin), 0);

    const vevent = new ICAL.Component('vevent');
    vevent.updatePropertyWithValue('summary', `${subject.name} (${subject.short})`);
    vevent.updatePropertyWithValue('location', room.name);
    vevent.updatePropertyWithValue('dtstart', ICAL.Time.fromJSDate(startTime));
    vevent.updatePropertyWithValue('dtend', ICAL.Time.fromJSDate(endTime));
    vevent.updatePropertyWithValue('uid', Math.random().toString(36).substring(2));

    calendar.addSubcomponent(vevent);
}

function downloadICS(calendar, teacherShort) {
    const blob = new Blob([calendar.toString()], { type: 'text/calendar' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timetable_${teacherShort.replace(/[\[\]]/g, '')}.ics`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

function updatePreview(teacherId) {
    const previewSection = document.getElementById('previewSection');
    if (!previewSection) return;

    let tablesContainer = document.getElementById('timetableTables');
    if (!tablesContainer) {
        tablesContainer = document.createElement('div');
        tablesContainer.id = 'timetableTables';
        previewSection.appendChild(tablesContainer);
    }
    
    // Update only the tables container with odd/even week tables based on configuration
    let tablesHTML = '<div class="timetable-container">';
    
    if (showOddWeeks) {
        tablesHTML += `
            <div class="week-table">
                <h3 class="week-header">Odd Week</h3>
                <table id="oddWeekTable" class="preview-table">
                    <thead>
                        <tr>
                            <th>Day</th>
                            <th>Time</th>
                            <th>Subject</th>
                            <th>Room</th>
                            <th>Week Type</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>`;
    }
    
    if (showEvenWeeks) {
        tablesHTML += `
            <div class="week-table">
                <h3 class="week-header">Even Week</h3>
                <table id="evenWeekTable" class="preview-table">
                    <thead>
                        <tr>
                            <th>Day</th>
                            <th>Time</th>
                            <th>Subject</th>
                            <th>Room</th>
                            <th>Week Type</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>`;
    }
    
    tablesHTML += '</div>';
    tablesContainer.innerHTML = tablesHTML;

    const oddWeekTable = showOddWeeks ? document.getElementById('oddWeekTable').getElementsByTagName('tbody')[0] : null;
    const evenWeekTable = showEvenWeeks ? document.getElementById('evenWeekTable').getElementsByTagName('tbody')[0] : null;
    const lessons = xmlData.querySelectorAll(`lesson[teacherids*="${teacherId}"]`);
    const lessonMap = new Map();
    
    lessons.forEach(lesson => {
        const lessonId = lesson.getAttribute('id');
        const subjectId = lesson.getAttribute('subjectid');
        const subject = mappings.subjects[subjectId] || { name: 'Unknown', short: 'Unknown' };
        const weeksdefId = lesson.getAttribute('weeksdefid');
        
        if (subject.name.includes('HBL') || subject.name.includes('Home Based Learning')) {
            return;
        }

        const classIds = (lesson.getAttribute('classids') || '').split(',').filter(Boolean);
        const classNames = classIds.length > 3 
            ? 'Multiple Classes'
            : classIds.map(id => mappings.classes[id]?.name || 'Unknown').join(', ');

        const cards = xmlData.querySelectorAll(`card[lessonid="${lessonId}"]`);
        const dayGroups = new Map();
        
        cards.forEach(card => {
            const daysPattern = card.getAttribute('days');
            const periodId = parseInt(card.getAttribute('period'));
            const roomIds = (card.getAttribute('classroomids') || '').split(',').filter(Boolean);
            const rooms = roomIds.map(id => mappings.rooms[id]?.name || 'Unknown');
            const roomDisplay = rooms.length > 2 ? 'Multiple Venues' : rooms.join(' & ');
            
            let weekPatterns;
            if (weeksdefId === '4CEEF5CAAC1CEE35') {
                weekPatterns = ['11'];
            } else if (weeksdefId === 'F20BB99A3CE4D221') {
                weekPatterns = ['01'];
            } else if (weeksdefId === '1DE69DF37257B010') {
                weekPatterns = ['10'];
            } else {
                weekPatterns = [card.getAttribute('weeks')];
            }
            
            weekPatterns.forEach(weeks => {
                for (let dayIndex = 0; dayIndex < daysPattern.length; dayIndex++) {
                    if (daysPattern[dayIndex] !== '1') continue;
                    
                    const key = `${dayIndex}-${weeks}-${roomDisplay}`;
                    if (!dayGroups.has(key)) {
                        dayGroups.set(key, {
                            startPeriod: periodId,
                            endPeriod: periodId,
                            weeks,
                            dayIndex,
                            room: roomDisplay,
                            subject: subject.name,
                            className: classNames
                        });
                    } else {
                        const group = dayGroups.get(key);
                        if (periodId === group.endPeriod + 1) {
                            group.endPeriod = periodId;
                        }
                    }
                }
            });
        });

        dayGroups.forEach((group, key) => {
            const startPeriodInfo = mappings.periods[group.startPeriod];
            const endPeriodInfo = mappings.periods[group.endPeriod];
            
            const weekType = group.weeks === '11' ? 'Every Week' : 
                           group.weeks === '10' ? 'Odd Week' : 
                           group.weeks === '01' ? 'Even Week' : 'Every Week';
            
            lessonMap.set(key, {
                day: group.dayIndex,
                startTime: startPeriodInfo?.start || '07:30',
                endTime: endPeriodInfo?.end || '08:00',
                subject: group.subject,
                className: group.className,
                room: group.room,
                weekType: weekType,
                isOddWeek: weekType === 'Odd Week',
                startPeriod: group.startPeriod
            });
        });
    });

    const lessonEntries = Array.from(lessonMap.values()).sort((a, b) => {
        if (a.day !== b.day) return a.day - b.day;
        return a.startPeriod - b.startPeriod;
    });

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    
    // Create row HTML for a lesson entry
    const createRow = entry => `
        <tr>
            <td>${days[entry.day]}</td>
            <td>${entry.startTime} - ${entry.endTime}</td>
            <td>${entry.subject}${entry.className ? ` (${entry.className})` : ''}</td>
            <td>${entry.room}</td>
            <td>${entry.weekType}</td>
        </tr>
    `;

    // Filter and display lessons for each week
    const oddWeekLessons = lessonEntries.filter(entry => 
        entry.weekType === 'Odd Week' || entry.weekType === 'Every Week'
    );
    const evenWeekLessons = lessonEntries.filter(entry => 
        entry.weekType === 'Even Week' || entry.weekType === 'Every Week'
    );

    if (oddWeekTable) {
        oddWeekTable.innerHTML = oddWeekLessons.length ? 
            oddWeekLessons.map(createRow).join('') : 
            '<tr><td colspan="5">No lessons found for this week</td></tr>';
    }

    if (evenWeekTable) {
        evenWeekTable.innerHTML = evenWeekLessons.length ? 
            evenWeekLessons.map(createRow).join('') : 
            '<tr><td colspan="5">No lessons found for this week</td></tr>';
    }
}
