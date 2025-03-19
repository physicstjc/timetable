// Remove any import/export statements at the top of the file
let xmlData = null;
let mappings = {
    teachers: {},
    subjects: {},
    rooms: {},
    classes: {},
    periods: {},
    daysdef: {}
};
// Add after the selectedTeachers declaration at the top
let selectedTeachers = new Set(JSON.parse(localStorage.getItem('selectedTeachers') || '[]'));

// Modify the loadDefaultTimetable function to update the UI after loading
async function loadDefaultTimetable() {
    try {
        const response = await fetch('asctt2012.xml');
        const text = await response.text();
        const parser = new DOMParser();
        xmlData = parser.parseFromString(text, 'text/xml');
        
        // Parse mappings
        ['teachers', 'subjects', 'classrooms', 'classes', 'periods', 'daysdef'].forEach(type => {
            const elements = xmlData.querySelectorAll(type === 'classrooms' ? 'classroom' : type.slice(0, -1));
            elements.forEach(element => {
                const id = type === 'periods' ? element.getAttribute('period') : element.getAttribute('id');
                if (type === 'classes') {
                    console.log('Loading class:', id, element.getAttribute('name'));
                }
                mappings[type === 'classrooms' ? 'rooms' : type][id] = {
                    id: id,  // Add the ID to the mapping
                    name: element.getAttribute('name'),
                    short: element.getAttribute('short'),
                    ...(type === 'periods' && { 
                        start: element.getAttribute('starttime')
                    })
                };
            });
        });

        // Debug log to check periods
        console.log('Sample period:', xmlData.querySelector('period')?.outerHTML);
        console.log('Loaded periods:', mappings.periods);

        // After loading data, populate the department select
        populateDepartmentSelect();
        updateTeacherCheckboxes(); // Add this line to show all teachers immediately
        updateSelectedTeachersList();
        updateComparison();
    } catch (error) {
        console.error('Error loading timetable:', error);
        alert('Failed to load the timetable file.');
    }
}

function populateDepartmentSelect() {
    const departmentSelect = document.getElementById('departmentSelect');
    departmentSelect.innerHTML = '<option value="">All Departments</option>';
    
    // Sort departments alphabetically by their full names
    const sortedDepartments = Object.entries(departments).sort((a, b) => a[1].localeCompare(b[1]));
    
    sortedDepartments.forEach(([code, name]) => {
        const option = document.createElement('option');
        option.value = code;
        option.textContent = `${name} [${code}]`;
        departmentSelect.appendChild(option);
    });
}

// Make sure this is called after DOM is loaded
// Add at the top with other initializations
function getCurrentDayIndex() {
    const today = new Date();
    const dayIndex = today.getDay() - 1; // Convert Sunday(0) to Friday(4)
    return dayIndex >= 0 && dayIndex <= 4 ? dayIndex : 0; // Default to Monday if weekend
}

// Update the DOMContentLoaded event listener
// In the DOMContentLoaded event listener, add these event listeners
// Move these functions before DOMContentLoaded
function updateComparison() {
    const timetableDiv = document.querySelector('.timetable');
    
    if (selectedTeachers.size === 0) {
        timetableDiv.classList.remove('visible');
        return;
    }

    timetableDiv.classList.add('visible');

    const selectedDay = parseInt(document.getElementById('daySelect').value);
    const weekType = document.getElementById('weekType').value;
    // Use the actual week patterns from the cards
    const weekPattern = weekType === 'odd' ? '01' : '10';
    const everyWeekPattern = '11'; // Pattern for every week

    // Create time slots array (7:30 AM to 6:00 PM)
    const timeSlots = [];
    for (let hour = 7; hour <= 18; hour++) {
        const formattedHour = hour.toString();  // Remove padStart
        if (hour === 7) {
            timeSlots.push(`${formattedHour}:30`);
        } else if (hour === 18) {
            timeSlots.push(`${formattedHour}:00`);
        } else {
            timeSlots.push(`${formattedHour}:00`, `${formattedHour}:30`);
        }
    }

    // Generate table
    const table = document.createElement('table');
    
    // Create header row
    const headerRow = table.insertRow();
    const timeHeader = headerRow.insertCell();
    timeHeader.textContent = 'Time';
    timeHeader.className = 'time-cell';
    
    selectedTeachers.forEach(teacherId => {
        const teacher = mappings.teachers[teacherId];
        const cell = headerRow.insertCell();
        cell.textContent = teacher.name;
    });

    // Create time slot rows
    timeSlots.forEach(time => {
        const row = table.insertRow();
        const timeCell = row.insertCell();
        timeCell.textContent = time;
        timeCell.className = 'time-cell';

        selectedTeachers.forEach(teacherId => {
            const cell = row.insertCell();
            const lesson = findLesson(teacherId, selectedDay, time, weekPattern, everyWeekPattern);
            
            if (lesson) {
                cell.className = 'lesson-slot';
                cell.innerHTML = `
                    <div class="lesson-content">
                        <div class="lesson-subject">${lesson.subject}</div>
                        <div class="lesson-details">
                            <span class="lesson-class">${lesson.className}</span>
                            <span class="lesson-room">${lesson.room}</span>
                        </div>
                    </div>`;
            } else {
                cell.className = 'free-slot';
                cell.textContent = 'Free';
            }
        });
    });

    const comparisonTable = document.getElementById('comparisonTable');
    comparisonTable.innerHTML = '';
    comparisonTable.appendChild(table);
}

function findLesson(teacherId, day, time, weekPattern, everyWeekPattern) {
    // Find the period that matches this time
    const periodId = Object.entries(mappings.periods)
        .find(([, period]) => {
            console.log(`Comparing time ${time} with period start ${period.start}, period:`, period);
            return period.start === time || 
                   (time === '7:30' && period.start === '07:30') ||
                   (time === period.start.replace(/^0/, ''));
        })?.[0];
    
    if (!periodId) {
        console.log(`No period found for time: ${time}`);
        return null;
    }
    console.log(`Found period ${periodId} for time ${time}`);

    // Find all lessons for this teacher
    const lessons = xmlData.querySelectorAll(`lesson[teacherids*="${teacherId}"]`);
    
    for (const lesson of lessons) {
        const lessonId = lesson.getAttribute('id');
        
        // Look for cards matching this specific lesson
        const cards = xmlData.querySelectorAll(
            `card[lessonid="${lessonId}"][period="${periodId}"]`
        );
        
        // Check each card for matching week pattern and day
        const card = Array.from(cards).find(c => {
            const cardWeeks = c.getAttribute('weeks');
            const cardDays = c.getAttribute('days');
            return (cardWeeks === '4CEEF5CAAC1CEE35' || cardWeeks === weekPattern || cardWeeks === everyWeekPattern) 
                   && cardDays?.charAt(day) === '1';
        });
        
        if (card) {
            const subjectId = lesson.getAttribute('subjectid');
            const subject = mappings.subjects[subjectId];
            const roomId = card.getAttribute('classroomids')?.split(',')[0];
            const room = mappings.rooms[roomId];
            const classIds = lesson.getAttribute('classids')?.split(',');
            
            // Map class IDs to names, leave blank if unknown
            const className = classIds?.length > 1 
                ? 'Multiple Classes'
                : classIds?.map(id => {
                    return classIdMapping[id] || mappings.classes[id]?.name || '';
                }).join(', ') || '';

            return {
                subject: subject?.name || 'Unknown Subject',
                room: room?.name || 'Unknown Room',
                className
            };
        }
    }
    
    return null;
}

function updateWeekType() {
    const selectedDate = new Date(document.getElementById('selectedDate').value);
    const startOfYear = new Date(selectedDate.getFullYear(), 0, 1);
    const weekNumber = Math.ceil(((selectedDate - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
    
    const weekNumberDisplay = document.getElementById('weekNumberDisplay');
    weekNumberDisplay.textContent = `(Week ${weekNumber})`;
    
    // Don't automatically change the week type, let user decide
    updateComparison();
}

// At the top of compare.js, add:
import { classIdMapping } from './mappings.js';

document.addEventListener('DOMContentLoaded', () => {
    loadDefaultTimetable();
    
    // Set default day to current day
    const daySelect = document.getElementById('daySelect');
    daySelect.value = getCurrentDayIndex();
    
    // Add event listeners for day and week type changes
    daySelect.addEventListener('change', updateComparison);
    document.getElementById('weekType').addEventListener('change', updateComparison);
    
    document.getElementById('departmentSelect').addEventListener('change', updateTeacherCheckboxes);
});

// Modify the updateTeacherCheckboxes function
function updateTeacherCheckboxes() {
    const department = document.getElementById('departmentSelect').value;
    const container = document.getElementById('teacherCheckboxes');
    container.innerHTML = '';
    
    container.classList.add('visible');
    
    Object.entries(mappings.teachers)
        .filter(([, teacher]) => !department || teacher.short.startsWith(`[${department}]`))
        .sort(([, a], [, b]) => a.name.localeCompare(b.name))
        .forEach(([id, teacher]) => {
            const div = document.createElement('div');
            div.className = 'teacher-checkbox-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `teacher-${id}`;
            checkbox.value = id;
            checkbox.checked = selectedTeachers.has(id);
            
            // Add immediate update on checkbox change
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    selectedTeachers.add(id);
                } else {
                    selectedTeachers.delete(id);
                }
                localStorage.setItem('selectedTeachers', JSON.stringify([...selectedTeachers]));
                updateSelectedTeachersList();
                updateComparison();
            });

            const label = document.createElement('label');
            label.htmlFor = `teacher-${id}`;
            label.textContent = teacher.name;

            div.appendChild(checkbox);
            div.appendChild(label);
            container.appendChild(div);
        });
}

// Remove the applyTeacherFilter function since it's no longer needed
function applyTeacherFilter() {
    const checkboxes = document.querySelectorAll('#teacherCheckboxes input[type="checkbox"]:checked');
    checkboxes.forEach(checkbox => {
        selectedTeachers.add(checkbox.value);
    });
    updateSelectedTeachersList();
    updateComparison();
}

// Update the removeTeacher function
// Make removeTeacher globally accessible
window.removeTeacher = function(teacherId) {
    selectedTeachers.delete(teacherId);
    localStorage.setItem('selectedTeachers', JSON.stringify([...selectedTeachers]));
    const checkbox = document.getElementById(`teacher-${teacherId}`);
    if (checkbox) checkbox.checked = false;
    updateSelectedTeachersList();
    updateComparison();
};

function populateTeacherSelect() {
    const teacherSelect = document.getElementById('teacherSelect');
    teacherSelect.innerHTML = '<option value="">Select a teacher...</option>';
    
    Object.entries(mappings.teachers)
        .sort(([, a], [, b]) => a.name.localeCompare(b.name))
        .forEach(([id, teacher]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = `${teacher.name} [${teacher.short}]`;
            teacherSelect.appendChild(option);
        });
}

// Update the addTeacher function
function addTeacher() {
    const select = document.getElementById('teacherSelect');
    const teacherId = select.value;
    
    if (!teacherId || selectedTeachers.has(teacherId)) return;
    
    selectedTeachers.add(teacherId);
    localStorage.setItem('selectedTeachers', JSON.stringify([...selectedTeachers]));
    updateSelectedTeachersList();
    updateComparison();
}

// Add this new function
window.removeAllTeachers = function() {
    selectedTeachers.clear();
    localStorage.setItem('selectedTeachers', JSON.stringify([...selectedTeachers]));
    
    // Uncheck all checkboxes
    const checkboxes = document.querySelectorAll('#teacherCheckboxes input[type="checkbox"]');
    checkboxes.forEach(checkbox => checkbox.checked = false);
    
    updateSelectedTeachersList();
    updateComparison();
};

function updateSelectedTeachersList() {
    const container = document.getElementById('selectedTeachers');
    container.innerHTML = '';
    
    // Add the "Remove All" button if there are selected teachers
    if (selectedTeachers.size > 0) {
        const removeAllBtn = document.createElement('button');
        removeAllBtn.className = 'remove-all-btn';
        removeAllBtn.textContent = 'Remove All';
        removeAllBtn.onclick = removeAllTeachers;
        container.appendChild(removeAllBtn);
    }
    
    selectedTeachers.forEach(teacherId => {
        const teacher = mappings.teachers[teacherId];
        const tag = document.createElement('div');
        tag.className = 'teacher-tag';
        tag.innerHTML = `
            ${teacher.name} [${teacher.short}]
            <span class="remove-teacher" onclick="removeTeacher('${teacherId}')">&times;</span>
        `;
        container.appendChild(tag);
    });
}