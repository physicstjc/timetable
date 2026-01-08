let xmlData = null;
let mappings = {
    teachers: {},
    subjects: {},
    rooms: {},
    classes: {},
    periods: {},
    daysdef: {}
};
let currentWeekType = 'even';
let selectedClassId = null;

// Load default timetable data
async function loadDefaultTimetable() {
    try {
        const response = await fetch('timetables/SOTY2026.xml');
        const text = await response.text();
        const parser = new DOMParser();
        xmlData = parser.parseFromString(text, 'text/xml');
        
        // Parse mappings
        ['teachers', 'subjects', 'classrooms', 'classes', 'periods', 'daysdef'].forEach(type => {
            let elementSelector;
            if (type === 'classrooms') {
                elementSelector = 'classroom';
            } else if (type === 'classes') {
                elementSelector = 'class';
            } else {
                elementSelector = type.slice(0, -1);
            }
            
            const elements = xmlData.querySelectorAll(elementSelector);
            elements.forEach(element => {
                const id = type === 'periods' ? element.getAttribute('period') : element.getAttribute('id');
                mappings[type === 'classrooms' ? 'rooms' : type][id] = {
                    id: id,
                    name: element.getAttribute('name'),
                    short: element.getAttribute('short'),
                    ...(type === 'periods' && { 
                        start: element.getAttribute('starttime'),
                        end: element.getAttribute('endtime')
                    })
                };
            });
        });

        // Populate class select
        populateClassSelect();
        
    } catch (error) {
        console.error('Error loading timetable data:', error);
    }
}

// Populate the class select dropdown
function populateClassSelect() {
    const classSelect = document.getElementById('classSelect');
    classSelect.innerHTML = '<option value="">Choose a class...</option>';
    
    // Sort classes by name
    const sortedClasses = Object.entries(mappings.classes)
        .sort(([,a], [,b]) => a.name.localeCompare(b.name));
    
    sortedClasses.forEach(([id, classData]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = classData.name || classData.short || 'N/A';
        classSelect.appendChild(option);
    });
}

// Set week type (odd/even)
function setWeekType(weekType) {
    currentWeekType = weekType;
    
    // Update button states
    document.getElementById('oddWeekBtn').classList.toggle('active', weekType === 'odd');
    document.getElementById('evenWeekBtn').classList.toggle('active', weekType === 'even');
    
    // Update timetable if a class is selected
    if (selectedClassId) {
        updateTimetable();
    }
}

// Update timetable when class selection changes
function updateTimetable() {
    const classSelect = document.getElementById('classSelect');
    selectedClassId = classSelect.value;
    
    if (!selectedClassId) {
        hideClassInfo();
        clearTimetable();
        return;
    }
    
    showClassInfo();
    populateTimetable();
}

// Show class information
function showClassInfo() {
    const classInfo = document.getElementById('classInfo');
    const className = document.getElementById('className');
    const classDetails = document.getElementById('classDetails');
    
    const classData = mappings.classes[selectedClassId];
    if (classData) {
        className.textContent = classData.name;
        classDetails.textContent = `Class Code: ${classData.short || 'N/A'} | Viewing: ${currentWeekType.charAt(0).toUpperCase() + currentWeekType.slice(1)} Week`;
        classInfo.style.display = 'block';
    }
}

// Hide class information
function hideClassInfo() {
    document.getElementById('classInfo').style.display = 'none';
}

// Clear timetable
function clearTimetable() {
    const tbody = document.getElementById('timetableBody');
    tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">Please select a class to view its timetable</td></tr>';
}

// Populate timetable with class schedule
function populateTimetable() {
    const tbody = document.getElementById('timetableBody');
    tbody.innerHTML = '';
    
    // Get all periods and sort them by time
    const periods = Object.values(mappings.periods)
        .filter(period => period.start) // Only periods with start times
        .sort((a, b) => {
            const timeA = a.start || '00:00';
            const timeB = b.start || '00:00';
            // Convert time strings to minutes for proper comparison
            const getMinutes = (timeStr) => {
                const [hours, minutes] = timeStr.split(':').map(Number);
                return hours * 60 + minutes;
            };
            return getMinutes(timeA) - getMinutes(timeB);
        });
    
    if (periods.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">No periods found</td></tr>';
        return;
    }
    
    // Create a row for each period
    periods.forEach(period => {
        const row = document.createElement('tr');
        
        // Time cell
        const timeCell = document.createElement('td');
        timeCell.className = 'time-cell';
        timeCell.textContent = `${period.start || 'N/A'} - ${period.end || 'N/A'}`;
        row.appendChild(timeCell);
        
        // Day cells (Monday to Friday)
        for (let day = 0; day < 5; day++) {
            const dayCell = document.createElement('td');
            const lessons = findLessonsForClassPeriodDay(selectedClassId, period.id, day);
            
            if (lessons.length > 0) {
                lessons.forEach(lesson => {
                    const lessonDiv = document.createElement('div');
                    const subjectName = mappings.subjects[lesson.subjectId]?.name || '';
                    lessonDiv.className = subjectName === 'Break' ? 'lesson-cell break' : 'lesson-cell';
                    
                    const subjectDiv = document.createElement('div');
                    subjectDiv.className = 'lesson-subject';
                    subjectDiv.textContent = mappings.subjects[lesson.subjectId]?.short || 'Unknown Subject';
                    
                    const teacherDiv = document.createElement('div');
                    teacherDiv.className = 'lesson-teacher';
                    const teacherIds = lesson.teacherIds ? lesson.teacherIds.split(',') : [];
                    if (teacherIds.length > 4) {
                        teacherDiv.textContent = 'Multiple Teachers';
                    } else {
                        const teacherNames = teacherIds.map(id => mappings.teachers[id]?.short || 'Unknown').join(', ');
                        teacherDiv.textContent = teacherNames || 'No Teacher';
                    }
                    
                    const roomDiv = document.createElement('div');
                    roomDiv.className = 'lesson-room';
                    const roomIds = lesson.classroomIds ? lesson.classroomIds.split(',') : [];
                    if (roomIds.length > 4) {
                        roomDiv.textContent = 'Multiple Venues';
                    } else {
                        const roomNames = roomIds.map(id => mappings.rooms[id]?.short || 'Unknown').join(', ');
                        roomDiv.textContent = roomNames || 'No Room';
                    }
                    
                    lessonDiv.appendChild(subjectDiv);
                    lessonDiv.appendChild(teacherDiv);
                    lessonDiv.appendChild(roomDiv);
                    dayCell.appendChild(lessonDiv);
                });
            } else {
                dayCell.innerHTML = '<span class="empty-cell">-</span>';
            }
            
            row.appendChild(dayCell);
        }
        
        tbody.appendChild(row);
    });
}

// Find lessons for a specific class, period, and day
function findLessonsForClassPeriodDay(classId, periodId, dayIndex) {
    if (!xmlData) return [];
    
    const lessons = [];
    const cards = xmlData.querySelectorAll('card');
    
    cards.forEach(card => {
        const lessonId = card.getAttribute('lessonid');
        const period = card.getAttribute('period');
        const days = card.getAttribute('days');
        const weeks = card.getAttribute('weeks');
        
        // Check if this card matches our criteria
        if (period === periodId && days && days.charAt(dayIndex) === '1') {
            // Check week type
            const isOddWeek = weeks === '10' || weeks === '11'; // '10' = odd only, '11' = every week
            const isEvenWeek = weeks === '01' || weeks === '11'; // '01' = even only, '11' = every week
            
            if ((currentWeekType === 'odd' && !isOddWeek) || (currentWeekType === 'even' && !isEvenWeek)) {
                return; // Skip this lesson if it doesn't match the current week type
            }
            
            // Find the corresponding lesson
            const lesson = xmlData.querySelector(`lesson[id="${lessonId}"]`);
            if (lesson) {
                const classIds = lesson.getAttribute('classids');
                if (classIds && classIds.split(',').includes(classId)) {
                    lessons.push({
                        id: lessonId,
                        subjectId: lesson.getAttribute('subjectid'),
                        teacherIds: lesson.getAttribute('teacherids'),
                        classroomIds: lesson.getAttribute('classroomids'),
                        weeks: weeks
                    });
                }
            }
        }
    });
    
    return lessons;
}

// Initialize the page
async function loadSelectedXML(path) {
    try {
        const response = await fetch(path);
        const text = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/xml');
        if (doc.querySelector('parsererror')) {
            throw new Error('Invalid XML file');
        }
        xmlData = doc;

        // Rebuild mappings from xmlData
        mappings = {
            teachers: {},
            subjects: {},
            rooms: {},
            classes: {},
            periods: {},
            daysdef: {}
        };

        ['teachers', 'subjects', 'classrooms', 'classes', 'periods', 'daysdef'].forEach(type => {
            let elementSelector;
            if (type === 'classrooms') {
                elementSelector = 'classroom';
            } else if (type === 'classes') {
                elementSelector = 'class';
            } else {
                elementSelector = type.slice(0, -1);
            }
            const elements = xmlData.querySelectorAll(elementSelector);
            elements.forEach(element => {
                const id = type === 'periods' ? element.getAttribute('period') : element.getAttribute('id');
                mappings[type === 'classrooms' ? 'rooms' : type][id] = {
                    id: id,
                    name: element.getAttribute('name'),
                    short: element.getAttribute('short'),
                    ...(type === 'periods' && {
                        start: element.getAttribute('starttime'),
                        end: element.getAttribute('endtime')
                    })
                };
            });
        });

        // Repopulate classes based on new XML
        populateClassSelect();

        // Clear current class selection and timetable
        const classSelect = document.getElementById('classSelect');
        if (classSelect) {
            classSelect.value = '';
        }
        selectedClassId = null;
        clearTimetable();
    } catch (err) {
        console.error('Failed to load selected XML:', err);
        alert(`Failed to load selected XML: ${err.message}`);
    }
}

function populateXMLDropdown() {
    const select = document.getElementById('xmlSelect');
    if (!select) return;

    // Reset dropdown
    select.innerHTML = '';

    // Helper to add unique options (normalize to basename)
    const added = new Set();
    const addOption = (name) => {
        const fileName = name.split('/').pop(); // normalize in case listing includes a path
        if (added.has(fileName)) return;
        added.add(fileName);

        const option = document.createElement('option');
        option.value = `timetables/${fileName}`;
        option.textContent = fileName;
        select.appendChild(option);
    };

    // Try listing the timetables directory; fallback to known list (exclude asctt2012.xml)
    fetch('timetables/')
        .then(res => {
            if (!res.ok) throw new Error(`Failed to list timetables/: ${res.status}`);
            return res.text();
        })
        .then(html => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const links = Array.from(doc.querySelectorAll('a')).map(a => a.getAttribute('href') || '');
            const xmlFiles = links.filter(href => href.toLowerCase().endsWith('.xml'));

            if (xmlFiles.length) {
                xmlFiles.forEach(addOption);
            } else {
                ['SOTY2026.xml'].forEach(addOption);
            }
        })
        .catch(() => {
            // Fallback: known filenames only from timetables/ (no asctt2012.xml)
            ['SOTY2026.xml'].forEach(addOption);
        })
        .finally(() => {
            // Select first option and load once
            if (select.options.length) {
                select.selectedIndex = 0;
                loadSelectedXML(select.value);
            }
        });

    if (select.options.length) {
        select.selectedIndex = 0;
        loadSelectedXML(select.value);
    }
    // Secondary fallback block: ensure asctt2012.xml is excluded
    ['SOTY2026.xml'].forEach(addOption);
    loadSelectedXML(select.value);
}

document.addEventListener('DOMContentLoaded', () => {
    const xmlSelect = document.getElementById('xmlSelect');
    if (xmlSelect) {
        populateXMLDropdown();
        xmlSelect.addEventListener('change', (e) => {
            loadSelectedXML(e.target.value);
        });
    } else {
        // Fallback if XML dropdown is not present
        loadDefaultTimetable();
    }
});

// Make functions available globally
window.setWeekType = setWeekType;
window.updateTimetable = updateTimetable;
