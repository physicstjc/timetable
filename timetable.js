let xmlData = null;
let mappings = null;

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
        const response = await fetch('asctt2012.xml');
        const xmlText = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        if (xmlDoc.querySelector('parsererror')) {
            throw new Error('Invalid XML file');
        }
        return xmlDoc;
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
    const departmentSet = new Set();
    
    // Extract unique department codes from teacher short names
    Object.values(mappings.teachers).forEach(teacher => {
        const match = teacher.short.match(/\[(.*?)[\]}]/);  // Handle both ] and } as closing brackets
        if (match && departments[match[1]]) {
            departmentSet.add(match[1]);
        }
    });

    const departmentSelect = document.getElementById('departmentSelect');
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
    const teacherSelect = document.getElementById('teacherSelect');

    try {
        if (!xmlData) {
            if (fileInput.files[0]) {
                xmlData = await loadXMLData(fileInput.files[0]);
            } else {
                xmlData = await loadDefaultXML();
                if (!xmlData) {
                    alert('Please select an XML file');
                    return;
                }
            }
            mappings = getMappings(xmlData);
            
            // Add department select population
            populateDepartmentSelect();
            updateTeacherSelect();
        }

        previewSection.style.display = 'block';
        
        if (teacherSelect.value) {
            updatePreview(teacherSelect.value);
        }
    } catch (error) {
        alert(`Error loading preview: ${error.message}`);
    }
}

// Add new function to update teacher select based on department
function updateTeacherSelect() {
    const departmentSelect = document.getElementById('departmentSelect');
    const teacherSelect = document.getElementById('teacherSelect');
    const selectedDepartment = departmentSelect.value;

    teacherSelect.innerHTML = '<option value="">Select a teacher...</option>';
    
    Object.entries(mappings.teachers)
        .filter(([, teacher]) => {
            if (!selectedDepartment) return true;
            const match = teacher.short.match(/\[(.*?)[\]}]/);  // Handle both ] and } as closing brackets
            return match && match[1] === selectedDepartment;
        })
        .sort(([, a], [, b]) => a.name.localeCompare(b.name))
        .forEach(([id, teacher]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = teacher.name;
            teacherSelect.appendChild(option);
        });
}

// Add event listener for department selection
document.addEventListener('DOMContentLoaded', async () => {
    await previewTimetable();
    document.getElementById('departmentSelect').addEventListener('change', updateTeacherSelect);
});

function updatePreview(teacherId) {
    const previewTable = document.getElementById('previewTable').getElementsByTagName('tbody')[0];
    const lessons = xmlData.querySelectorAll(`lesson[teacherids*="${teacherId}"]`);
    
    const lessonMap = new Map();
    
    lessons.forEach(lesson => {
        const lessonId = lesson.getAttribute('id');
        const weeksdefId = lesson.getAttribute('weeksdefid');
        const subjectId = lesson.getAttribute('subjectid');
        const subject = mappings.subjects[subjectId] || { name: 'Unknown', short: 'Unknown' };
        
        if (subject.name.includes('HBL') || subject.name.includes('Home Based Learning')) {
            return;
        }

        const classIds = (lesson.getAttribute('classids') || '').split(',').filter(Boolean);
        const classNames = classIds.length > 3 
            ? 'Multiple Classes'
            : classIds.map(id => mappings.classes[id]?.name || 'Unknown').join(', ');

        const cards = xmlData.querySelectorAll(`card[lessonid="${lessonId}"]`);
        const periodGroups = new Map();
        
        // First, group cards by day and week type
        cards.forEach(card => {
            const periodId = parseInt(card.getAttribute('period'));
            const daysPattern = card.getAttribute('days');
            const dayIndex = daysPattern.indexOf('1');
            const roomId = card.getAttribute('classroomids')?.split(',')[0];
            const room = mappings.rooms[roomId] || { name: 'Unknown', short: 'Unknown' };
            
            let weekTypes = [];
            if (weeksdefId === '4CEEF5CAAC1CEE35') {
                weekTypes = ['Every Week'];
            } else if (weeksdefId === 'F20BB99A3CE4D221') {
                weekTypes = ['Even Week'];
            } else if (weeksdefId === '1DE69DF37257B010') {
                weekTypes = ['Odd Week'];
            } else {
                weekTypes = [card.getAttribute('weeks') === '10' ? 'Odd Week' : 'Even Week'];
            }
            
            weekTypes.forEach(weekType => {
                const key = `${dayIndex}-${weekType}-${room.name}`;
                if (!periodGroups.has(key)) {
                    periodGroups.set(key, {
                        periods: [periodId],
                        day: dayIndex,
                        weekType,
                        room: room.name,
                        subject: subject.name,
                        className: classNames
                    });
                } else {
                    periodGroups.get(key).periods.push(periodId);
                }
            });
        });

        // Then, create lesson entries from grouped periods
        periodGroups.forEach((group, key) => {
            const sortedPeriods = group.periods.sort((a, b) => a - b);
            const startPeriod = sortedPeriods[0];
            const endPeriod = sortedPeriods[sortedPeriods.length - 1];
            
            const startPeriodInfo = mappings.periods[startPeriod];
            const endPeriodInfo = mappings.periods[endPeriod];
            
            lessonMap.set(key, {
                day: group.day,
                startTime: startPeriodInfo?.start || '07:30',
                endTime: endPeriodInfo?.end || '08:00',
                subject: group.subject,
                className: group.className,
                room: group.room,
                weekType: group.weekType,
                isOddWeek: group.weekType === 'Odd Week',
                startPeriod
            });
        });
    });

    // Sort and generate table content
    const lessonEntries = Array.from(lessonMap.values()).sort((a, b) => {
        if (a.isOddWeek !== b.isOddWeek) return b.isOddWeek - a.isOddWeek;
        if (a.day !== b.day) return a.day - b.day;
        return a.startPeriod - b.startPeriod;
    });

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const tableContent = lessonEntries.map(entry => `
        <tr>
            <td>${days[entry.day]}</td>
            <td>${entry.startTime} - ${entry.endTime}</td>
            <td>${entry.subject}${entry.className ? ` (${entry.className})` : ''}</td>
            <td>${entry.room}</td>
            <td>${entry.weekType}</td>
        </tr>
    `).join('');
    
    previewTable.innerHTML = tableContent || '<tr><td colspan="5">No lessons found for this teacher</td></tr>';
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

        // Create events for each day group
        dayGroups.forEach((group) => {
            // Get room from the card instead of the lesson
            const roomId = group.card.getAttribute('classroomids')?.split(',')[0];
            const room = mappings.rooms[roomId] || { name: 'Unknown', short: 'Unknown' };
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
            vevent.addPropertyWithValue('location', room.name);
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

// Add event listener for page load
document.addEventListener('DOMContentLoaded', async () => {
    await previewTimetable();
});

// Add event listener for teacher selection
document.getElementById('teacherSelect')?.addEventListener('change', (e) => {
    if (e.target.value) {
        updatePreview(e.target.value);
    }
});


function processXML() {
    const startDate = new Date(document.getElementById('startDate').value);
    const endDate = new Date(document.getElementById('endDate').value);
    const weekType = document.getElementById('weekType').value;
    const teacherSelect = document.getElementById('teacherSelect');
    
    if (!teacherSelect.value) {
        alert('Please select a teacher first');
        return;
    }

    if (!startDate || !endDate || isNaN(startDate) || isNaN(endDate)) {
        alert('Please select valid start and end dates');
        return;
    }
    
    if (endDate < startDate) {
        alert('End date must be after start date');
        return;
    }

    if (!xmlData || !mappings) {
        alert('Please preview the timetable first');
        return;
    }

    const teacherId = teacherSelect.value;
    const teacherInfo = mappings.teachers[teacherId];
    
    try {
        // Skip HBL entries check
        const lessons = xmlData.querySelectorAll(`lesson[teacherids*="${teacherId}"]`);
        let hasValidLessons = false;
        
        lessons.forEach(lesson => {
            const subjectId = lesson.getAttribute('subjectid');
            const subject = mappings.subjects[subjectId];
            if (!subject.name.includes('HBL') && !subject.name.includes('Home Based Learning')) {
                hasValidLessons = true;
            }
        });

        if (!hasValidLessons) {
            alert('No valid lessons found for this teacher (excluding HBL)');
            return;
        }

        const calendar = createTeacherCalendar(teacherId, startDate, endDate, weekType);
        if (!calendar) {
            throw new Error('Failed to create calendar');
        }
        downloadICS(calendar, teacherInfo.short);
        document.getElementById('progress').textContent = `Generated calendar for ${teacherInfo.name}`;
    } catch (error) {
        console.error(`Error details:`, error);
        alert(`Failed to generate calendar for ${teacherInfo.name}. Please check if there are valid lessons in the selected date range.`);
    }
}

// Add this function near the top of your file
function toggleInstructions() {
    const instructions = document.getElementById('instructions');
    const button = document.querySelector('button[onclick="toggleInstructions()"]');
    if (instructions.style.display === 'none') {
        instructions.style.display = 'block';
        button.textContent = 'Hide Instructions';
    } else {
        instructions.style.display = 'none';
        button.textContent = 'Show Instructions';
    }
}

// Add this near your other event listeners
document.getElementById('xmlFile')?.addEventListener('change', (e) => {
    const fileName = e.target.files[0]?.name || 'No file chosen';
    document.querySelector('.file-name').textContent = fileName;
});
