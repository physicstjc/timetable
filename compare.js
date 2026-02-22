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
let savedGroups = JSON.parse(localStorage.getItem('teacherGroups') || '{}');

// Modify the loadDefaultTimetable function to update the UI after loading
async function loadDefaultTimetable() {
    try {
        xmlData = await window.TimetableCommon.loadFirstAvailableXML('timetables/');
        mappings = window.TimetableCommon.buildMappings(xmlData);
    } catch (error) {
        console.error('Failed to load default timetable:', error);
        alert('Failed to load timetable XML from timetables/. Please ensure XML files exist there.');
    }
}

// Top-level helpers to load a selected XML and populate dropdown
async function loadSelectedXML(path) {
    try {
        const response = await fetch(path);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} when fetching ${path}`);
        }
        const text = await response.text();
        xmlData = window.TimetableCommon.parseXmlDocument(text);
        mappings = window.TimetableCommon.buildMappings(xmlData);

        // Refresh UI based on new XML
        populateDepartmentSelect();
        updateTeacherCheckboxes();
        updateSelectedTeachersList();
        updateGroupManagement();
        updateComparison();
    } catch (err) {
        console.error('Failed to load selected XML:', err);
        alert(`Failed to load selected XML: ${err.message}`);
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
    const weekPattern = weekType === 'odd' ? '10' : '01';
    const everyWeekPattern = '11';

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

    // Target existing table
    const comparisonTable = document.getElementById('comparisonTable');
    const thead = comparisonTable.querySelector('thead');
    const tbody = comparisonTable.querySelector('tbody');
    // Build header
    thead.innerHTML = '';
    const headerRow = document.createElement('tr');
    const timeHeader = document.createElement('th');
    timeHeader.textContent = 'Time';
    timeHeader.className = 'time-cell';
    headerRow.appendChild(timeHeader);
    selectedTeachers.forEach(teacherId => {
        const th = document.createElement('th');
        th.textContent = mappings.teachers[teacherId]?.name || 'Unknown';
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    // Build body
    tbody.innerHTML = '';
    timeSlots.forEach(time => {
        const row = document.createElement('tr');
        const timeCell = document.createElement('td');
        timeCell.textContent = time;
        timeCell.className = 'time-cell';
        row.appendChild(timeCell);
        selectedTeachers.forEach(teacherId => {
            const cell = document.createElement('td');
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
            row.appendChild(cell);
        });
        tbody.appendChild(row);
    });
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
        const weeksdefId = lesson.getAttribute('weeksdefid');
        
        // Look for cards matching this specific lesson
        const cards = xmlData.querySelectorAll(
            `card[lessonid="${lessonId}"][period="${periodId}"]`
        );
        
        // Check each card for matching week pattern and day
        const card = Array.from(cards).find(c => {
            const cardDays = c.getAttribute('days');
            
            // Handle different week patterns
            if (weeksdefId === '4CEEF5CAAC1CEE35') {
                return cardDays?.charAt(day) === '1'; // Every week
            } else if (weeksdefId === 'F20BB99A3CE4D221') {
                return cardDays?.charAt(day) === '1' && weekPattern === '01'; // Even week
            } else if (weeksdefId === '1DE69DF37257B010') {
                return cardDays?.charAt(day) === '1' && weekPattern === '10'; // Odd week
            } else {
                const cardWeeks = c.getAttribute('weeks');
                const isEveryWeek = cardWeeks === everyWeekPattern;
                return cardDays?.charAt(day) === '1' && (isEveryWeek || cardWeeks === weekPattern);
            }
        });
        
        if (card) {
            const subjectId = lesson.getAttribute('subjectid');
            const subject = mappings.subjects[subjectId];
            const roomId = card.getAttribute('classroomids')?.split(',')[0];
            const room = mappings.rooms[roomId];
            const classIds = lesson.getAttribute('classids')?.split(',');
            
            // Map class IDs to names, show up to two classes
            const className = classIds?.length > 2 
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
import { departments } from './departments.js';

// Add search functionality
function setupSearchFunctionality() {
    const searchInput = document.getElementById('teacherSearch');
    const clearButton = document.getElementById('clearSearch');
    
    searchInput.addEventListener('input', filterTeachers);
    clearButton.addEventListener('click', clearSearch);
    
    // Show/hide clear button based on input content
    searchInput.addEventListener('input', function() {
        clearButton.style.display = this.value ? 'block' : 'none';
    });
}

// Group management functions
function setupGroupManagement() {
    const saveBtn = document.getElementById('saveGroupBtn');
    const loadBtn = document.getElementById('loadGroupBtn');
    const deleteBtn = document.getElementById('deleteGroupBtn');
    const groupNameInput = document.getElementById('groupNameInput');
    const groupSelect = document.getElementById('groupSelect');
    
    saveBtn.addEventListener('click', saveCurrentGroup);
    loadBtn.addEventListener('click', loadSelectedGroup);
    deleteBtn.addEventListener('click', deleteSelectedGroup);
    
    // Allow saving with Enter key
    groupNameInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            saveCurrentGroup();
        }
    });
    
    // Update buttons state when selection changes
    groupSelect.addEventListener('change', updateGroupButtons);
    
    updateGroupManagement();
}

function saveCurrentGroup() {
    const groupNameInput = document.getElementById('groupNameInput');
    const groupName = groupNameInput.value.trim();
    
    if (!groupName) {
        alert('Please enter a group name.');
        return;
    }
    
    if (selectedTeachers.size === 0) {
        alert('Please select at least one teacher to save as a group.');
        return;
    }
    
    // Check if group name already exists
    if (savedGroups[groupName]) {
        if (!confirm(`A group named "${groupName}" already exists. Do you want to overwrite it?`)) {
            return;
        }
    }
    
    // Save the group
    savedGroups[groupName] = {
        teachers: [...selectedTeachers],
        created: new Date().toISOString(),
        teacherNames: [...selectedTeachers].map(id => mappings.teachers[id]?.name || 'Unknown')
    };
    
    localStorage.setItem('teacherGroups', JSON.stringify(savedGroups));
    
    // Clear input and update UI
    groupNameInput.value = '';
    updateGroupManagement();
    
    // Show success message
    alert(`Group "${groupName}" saved successfully!`);
}

function loadSelectedGroup() {
    const groupSelect = document.getElementById('groupSelect');
    const groupName = groupSelect.value;
    
    if (!groupName || !savedGroups[groupName]) {
        alert('Please select a group to load.');
        return;
    }
    
    loadGroup(groupName);
}

function loadGroup(groupName) {
    const group = savedGroups[groupName];
    if (!group) return;
    
    // Clear current selection
    selectedTeachers.clear();
    
    // Add teachers from the group (filter out any that no longer exist)
    group.teachers.forEach(teacherId => {
        if (mappings.teachers[teacherId]) {
            selectedTeachers.add(teacherId);
        }
    });
    
    // Update localStorage and UI
    localStorage.setItem('selectedTeachers', JSON.stringify([...selectedTeachers]));
    
    // Update checkboxes
    const checkboxes = document.querySelectorAll('#teacherCheckboxes input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectedTeachers.has(checkbox.value);
    });
    
    updateSelectedTeachersList();
    updateComparison();
    
    // Show which group was loaded
    alert(`Loaded group "${groupName}" with ${selectedTeachers.size} teachers.`);
}

function deleteSelectedGroup() {
    const groupSelect = document.getElementById('groupSelect');
    const groupName = groupSelect.value;
    
    if (!groupName || !savedGroups[groupName]) {
        alert('Please select a group to delete.');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete the group "${groupName}"?`)) {
        return;
    }
    
    delete savedGroups[groupName];
    localStorage.setItem('teacherGroups', JSON.stringify(savedGroups));
    
    updateGroupManagement();
    alert(`Group "${groupName}" deleted successfully.`);
}

function deleteGroup(groupName) {
    if (!confirm(`Are you sure you want to delete the group "${groupName}"?`)) {
        return;
    }
    
    delete savedGroups[groupName];
    localStorage.setItem('teacherGroups', JSON.stringify(savedGroups));
    updateGroupManagement();
}

function updateGroupManagement() {
    updateGroupSelect();
    updateGroupButtons();
}

function updateGroupSelect() {
    const groupSelect = document.getElementById('groupSelect');
    groupSelect.innerHTML = '<option value="">Load a saved group...</option>';
    
    Object.keys(savedGroups)
        .sort()
        .forEach(groupName => {
            const option = document.createElement('option');
            option.value = groupName;
            option.textContent = `${groupName} (${savedGroups[groupName].teachers.length} teachers)`;
            groupSelect.appendChild(option);
        });
}

function updateGroupButtons() {
    const groupSelect = document.getElementById('groupSelect');
    const loadBtn = document.getElementById('loadGroupBtn');
    const deleteBtn = document.getElementById('deleteGroupBtn');
    
    const hasSelection = groupSelect.value !== '';
    loadBtn.disabled = !hasSelection;
    deleteBtn.disabled = !hasSelection;
}

// Make functions globally accessible
window.loadGroup = loadGroup;

function filterTeachers() {
    const searchTerm = document.getElementById('teacherSearch').value.toLowerCase();
    const department = document.getElementById('departmentSelect').value;
    const container = document.getElementById('teacherCheckboxes');
    const checkboxItems = container.querySelectorAll('.teacher-checkbox-item');
    
    let hasVisibleResults = false;
    
    checkboxItems.forEach(item => {
        const label = item.querySelector('label');
        const teacherName = label.textContent.toLowerCase();
        
        const matchesSearch = !searchTerm || teacherName.includes(searchTerm);
        
        if (matchesSearch) {
            item.classList.remove('hidden');
            hasVisibleResults = true;
        } else {
            item.classList.add('hidden');
        }
    });
    
    // Show/hide "no results" message
    let noResultsMsg = container.querySelector('.no-results');
    if (!hasVisibleResults && (searchTerm || department)) {
        if (!noResultsMsg) {
            noResultsMsg = document.createElement('div');
            noResultsMsg.className = 'no-results';
            noResultsMsg.textContent = 'No teachers found matching your search.';
            container.appendChild(noResultsMsg);
        }
        noResultsMsg.style.display = 'block';
    } else if (noResultsMsg) {
        noResultsMsg.style.display = 'none';
    }
}

function clearSearch() {
    const searchInput = document.getElementById('teacherSearch');
    const clearButton = document.getElementById('clearSearch');
    
    searchInput.value = '';
    clearButton.style.display = 'none';
    filterTeachers(); // Re-filter to show all teachers
}

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize XML dropdown and hook change event
    const xmlSelect = document.getElementById('xmlSelect');
    if (xmlSelect) {
        await populateXMLDropdown(); // Call only once
        xmlSelect.addEventListener('change', async (e) => {
            await loadSelectedXML(e.target.value);
        });
    } else {
        // No dropdown: load from timetables/ using known files
        await loadDefaultTimetable();
    }

    // Continue with existing initialization (department/teacher UI, comparison table)
    const daySelect = document.getElementById('daySelect');
    daySelect.value = getCurrentDayIndex();

    daySelect.addEventListener('change', updateComparison);
    document.getElementById('weekType').addEventListener('change', updateComparison);
    const weekTypeSel = document.getElementById('weekType');
    if (weekTypeSel) {
        weekTypeSel.value = window.TimetableCommon.computeWeekTypeFromDate(new Date());
    }

    const deptSelect = document.getElementById('departmentSelect');
    if (deptSelect) {
        deptSelect.addEventListener('change', () => {
            updateTeacherCheckboxes();
            filterTeachers();
        });
    }

    setupSearchFunctionality();
    setupGroupManagement();
    if (mappings && Object.keys(mappings.teachers || {}).length) {
        updateComparison();
    }
    const relocate = () => {
        const filterSection = document.getElementById('filterSection');
        const teacherSelect = document.querySelector('.teacher-select');
        const search = document.querySelector('.search-container');
        const list = document.getElementById('teacherCheckboxes');
        if (!filterSection || !teacherSelect || !search || !list) return;
        if (window.innerWidth <= 768) {
            if (!filterSection.contains(search)) filterSection.appendChild(search);
            if (!filterSection.contains(list)) filterSection.appendChild(list);
        } else {
            if (!teacherSelect.contains(search)) teacherSelect.appendChild(search);
            if (!teacherSelect.contains(list)) teacherSelect.appendChild(list);
        }
    };
    relocate();
    window.addEventListener('resize', relocate);
});

// Modify the updateTeacherCheckboxes function
function updateTeacherCheckboxes() {
    const department = document.getElementById('departmentSelect').value;
    const container = document.getElementById('teacherCheckboxes');
    container.innerHTML = '';
    
    container.classList.add('visible');
    
    Object.entries(mappings.teachers)
        .filter(([, teacher]) => {
            if (!department) return true;
            return window.TimetableCommon.extractDepartmentCode(teacher.short) === department;
        })
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
    
    // Apply search filter after updating checkboxes
    filterTeachers();
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

function populateTeacherSelects() {
    const departmentSet = new Set();
    
    // Extract unique department codes from teacher short names
    Object.values(mappings.teachers).forEach(teacher => {
        const match = teacher.short.match(/\[(.*?)[\]}]/);  // Handle both ] and } as closing brackets
        if (match && departments[match[1]]) {
            departmentSet.add(match[1]);
        }
    });

    const departments1 = document.getElementById('departments1');
    const departments2 = document.getElementById('departments2');
    departments1.innerHTML = '<option value="">All Departments</option>';
    departments2.innerHTML = '<option value="">All Departments</option>';
    
    // Sort departments by their full names and create options
    Array.from(departmentSet)
        .sort((a, b) => departments[a].localeCompare(departments[b]))
        .forEach(dept => {
            const option1 = document.createElement('option');
            const option2 = document.createElement('option');
            option1.value = option2.value = dept;
            option1.textContent = option2.textContent = departments[dept];
            departments1.appendChild(option1);
            departments2.appendChild(option2.cloneNode(true));
        });

    updateTeacherSelect(1);
    updateTeacherSelect(2);
}

function updateTeacherSelect(selectNum) {
    const departmentSelect = document.getElementById(`departments${selectNum}`);
    const teacherSelect = document.getElementById(`teachers${selectNum}`);
    const selectedDepartment = departmentSelect.value;

    teacherSelect.innerHTML = '<option value="">Select a teacher...</option>';
    
    Object.entries(mappings.teachers)
        .filter(([, teacher]) => {
            if (!selectedDepartment) return true;
            return window.TimetableCommon.extractDepartmentCode(teacher.short) === selectedDepartment;
        })
        .sort(([, a], [, b]) => a.name.localeCompare(b.name))
        .forEach(([id, teacher]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = teacher.name;
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

// Add event listeners for department selection
// Removed unused department select bindings for non-existent elements on compare.html

// Guard flags to prevent duplicate dropdown population
let xmlDropdownLoading = false;
let xmlDropdownInitialized = false;

function populateXMLDropdown() {
    const select = document.getElementById('xmlSelect');
    if (!select) {
        xmlDropdownLoading = false;
        return;
    }

    select.innerHTML = '';
    const addOption = (name) => {
        const fileName = name.split('/').pop();
        const option = document.createElement('option');
        option.value = `timetables/${fileName}`;
        option.textContent = fileName;
        select.appendChild(option);
    };

    fetch('timetables/')
        .then(res => res.text())
        .then(html => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const links = Array.from(doc.querySelectorAll('a')).map(a => {
                const raw = a.getAttribute('href') || '';
                const cleaned = raw.split('?')[0].split('#')[0];
                return cleaned;
            });
            const xmlFiles = links.filter(href => href.toLowerCase().endsWith('.xml'));
            if (xmlFiles.length) {
                const preferred = [window.TimetableCommon.PREFERRED_TIMETABLE_FILE];
                const byLowerName = new Map();

                xmlFiles.forEach((path) => {
                    const fileName = path.split('/').pop();
                    const key = fileName.toLowerCase();

                    if (!byLowerName.has(key)) {
                        byLowerName.set(key, fileName);
                        return;
                    }

                    if (preferred.includes(fileName)) {
                        byLowerName.set(key, fileName);
                    }
                });

                const ordered = Array.from(byLowerName.values()).sort((a, b) => {
                    const aPref = preferred.includes(a);
                    const bPref = preferred.includes(b);
                    if (aPref && !bPref) return -1;
                    if (!aPref && bPref) return 1;
                    return a.localeCompare(b);
                });
                ordered.forEach(name => addOption(name));
            } else {
                window.TimetableCommon.DEFAULT_TIMETABLE_FILES.forEach(addOption);
            }
            if (select.options.length) {
                const preferred = [`timetables/${window.TimetableCommon.PREFERRED_TIMETABLE_FILE}`];
                let idx = -1;
                for (let i = 0; i < select.options.length; i++) {
                    if (preferred.includes(select.options[i].value)) { idx = i; break; }
                }
                select.selectedIndex = idx >= 0 ? idx : 0;
                loadSelectedXML(select.value);
            }
        })
        .catch(() => {
            window.TimetableCommon.DEFAULT_TIMETABLE_FILES.forEach(addOption);
            if (select.options.length) {
                const preferred = [`timetables/${window.TimetableCommon.PREFERRED_TIMETABLE_FILE}`];
                let idx = -1;
                for (let i = 0; i < select.options.length; i++) {
                    if (preferred.includes(select.options[i].value)) { idx = i; break; }
                }
                select.selectedIndex = idx >= 0 ? idx : 0;
                loadSelectedXML(select.value);
            }
        })
        .finally(() => {
            xmlDropdownLoading = false;
            xmlDropdownInitialized = true;
        });
}
