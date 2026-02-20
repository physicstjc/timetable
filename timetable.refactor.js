let xmlData = null;
let mappings = null;
let showOddWeeks = true;
let showEvenWeeks = true;

function setTimetableXML(xmlDoc) {
  xmlData = xmlDoc;
  window.xmlData = xmlDoc;
  mappings = getMappings(xmlDoc);
  const previewSection = document.getElementById('previewSection');
  if (previewSection) previewSection.style.display = 'block';
  const departmentSelect = document.getElementById('departmentSelect');
  const teacherSelect = document.getElementById('teacherSelect');
  if (departmentSelect) {
    populateDepartmentSelect();
    departmentSelect.value = '';
  }
  if (teacherSelect) {
    const prev = teacherSelect.value;
    updateTeacherSelect();
    if (prev) {
      teacherSelect.value = prev;
    }
    const tablesContainer = document.getElementById('timetableTables');
    if (tablesContainer && !teacherSelect.value) tablesContainer.innerHTML = '';
    teacherSelect.onchange = (e) => updatePreview(e.target.value);
    if (teacherSelect.value) {
      updatePreview(teacherSelect.value);
    }
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
        if (xmlDoc.querySelector('parsererror')) throw new Error('Invalid XML file');
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
  const m = { teachers: {}, periods: {}, subjects: {}, rooms: {}, daysdef: {}, weeksdef: {}, classes: {} };
  xmlDoc.querySelectorAll('class').forEach(cls => {
    m.classes[cls.getAttribute('id')] = { name: cls.getAttribute('name'), short: cls.getAttribute('short') };
  });
  xmlDoc.querySelectorAll('period').forEach(period => {
    m.periods[period.getAttribute('period')] = {
      id: period.getAttribute('id'),
      start: period.getAttribute('starttime'),
      end: period.getAttribute('endtime')
    };
  });
  xmlDoc.querySelectorAll('classroom').forEach(room => {
    m.rooms[room.getAttribute('id')] = { name: room.getAttribute('name'), short: room.getAttribute('short') };
  });
  xmlDoc.querySelectorAll('subject').forEach(subject => {
    m.subjects[subject.getAttribute('id')] = { name: subject.getAttribute('name'), short: subject.getAttribute('short') };
  });
  xmlDoc.querySelectorAll('teacher').forEach(teacher => {
    m.teachers[teacher.getAttribute('id')] = { name: teacher.getAttribute('name'), short: teacher.getAttribute('short') };
  });
  xmlDoc.querySelectorAll('daysdef').forEach(day => {
    m.daysdef[day.getAttribute('id')] = { days: day.getAttribute('days') };
  });
  xmlDoc.querySelectorAll('weeksdef').forEach(week => {
    m.weeksdef[week.getAttribute('id')] = { name: week.getAttribute('name'), weeks: week.getAttribute('weeks') };
  });
  return m;
}

async function loadDefaultXML() {
  try {
    const dirRes = await fetch('timetables/');
    if (dirRes.ok) {
      const html = await dirRes.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const links = Array.from(doc.querySelectorAll('a')).map(a => a.getAttribute('href') || '');
      const xmlFiles = links.filter(href => href.toLowerCase().endsWith('.xml'));
      if (xmlFiles.length > 0) {
        const path = `timetables/${xmlFiles[0]}`;
        const fileRes = await fetch(path);
        const xmlText = await fileRes.text();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        if (xmlDoc.querySelector('parsererror')) throw new Error('Invalid XML file');
        return xmlDoc;
      }
    }
    const fallbackFiles = ['Term1_W8_onwards.xml', 'Term1_W3_onwards.xml', 'SOTY2026.xml'];
    for (const name of fallbackFiles) {
      try {
        const res = await fetch(`timetables/${name}`);
        if (res.ok) {
          const xmlText = await res.text();
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
          if (xmlDoc.querySelector('parsererror')) continue;
          return xmlDoc;
        }
      } catch {}
    }
    try {
      const res = await fetch('SOTY2026.xml');
      if (res.ok) {
        const xmlText = await res.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        if (!xmlDoc.querySelector('parsererror')) return xmlDoc;
      }
    } catch {}
    throw new Error('No XML timetable files found in timetables/ or project root');
  } catch (error) {
    console.warn('Failed to load default XML:', error);
    return null;
  }
}

const departments = {
  AA: 'Arts Aesthetics',
  AE: 'Arts Economics',
  AG: 'Arts Geography',
  AH: 'Arts History',
  AM: 'Arts Music',
  E: 'English',
  M: 'Mathematics',
  MT: 'Mother Tongue Languages',
  PE: 'Physical Education',
  PW: 'Project Work',
  SB: 'Science Biology',
  SC: 'Science Chemistry',
  SP: 'Science Physics'
};
window.departments = departments;

function populateDepartmentSelect() {
  if (!mappings || !mappings.teachers) return;
  const departmentSelect = document.getElementById('departmentSelect');
  if (!departmentSelect) return;
  const depMap = window.departments || departments || {
    AA: 'Arts Aesthetics',
    AE: 'Arts Economics',
    AG: 'Arts Geography',
    AH: 'Arts History',
    AM: 'Arts Music',
    E: 'English',
    M: 'Mathematics',
    MT: 'Mother Tongue Languages',
    PE: 'Physical Education',
    PW: 'Project Work',
    SB: 'Science Biology',
    SC: 'Science Chemistry',
    SP: 'Science Physics'
  };
  const departmentSet = new Set();
  Object.values(mappings.teachers).forEach(teacher => {
    const match = teacher.short?.match(/\[(.*?)[\]}]/);
    if (match && depMap[match[1]]) departmentSet.add(match[1]);
  });
  departmentSelect.innerHTML = '<option value="">All Departments</option>';
  Array.from(departmentSet)
    .sort((a, b) => depMap[a].localeCompare(depMap[b]))
    .forEach(dept => {
      const option = document.createElement('option');
      option.value = dept;
      option.textContent = depMap[dept];
      departmentSelect.appendChild(option);
    });
}

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
    if (deptEl) {
      populateDepartmentSelect();
      deptEl.value = '';
    }
    if (teacherEl) {
      const prev = teacherEl.value;
      updateTeacherSelect();
      if (prev) teacherEl.value = prev;
    }
    if (previewSection) previewSection.style.display = 'block';
    if (teacherEl && teacherEl.value) updatePreview(teacherEl.value);
  } catch (error) {
    alert(`Error loading preview: ${error.message}`);
  }
}

function updateTeacherSelect() {
  const departmentSelect = document.getElementById('departmentSelect');
  const teacherSelect = document.getElementById('teacherSelect');
  if (!teacherSelect || !mappings || !mappings.teachers) return;
  const selectedDepartment = departmentSelect ? departmentSelect.value : '';
  const prev = teacherSelect.value;
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
  const toRender = filtered.length > 0 ? filtered : entries;
  teacherSelect.innerHTML = '<option value="">Select a teacher...</option>';
  toRender
    .sort(([, a], [, b]) => a.name.localeCompare(b.name))
    .forEach(([id, teacher]) => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = teacher.name;
      teacherSelect.appendChild(option);
    });
  if (prev && [...teacherSelect.options].some(o => o.value === prev)) {
    teacherSelect.value = prev;
  }
  if (!teacherSelect.value) {
    const tablesContainer = document.getElementById('timetableTables');
    if (tablesContainer) tablesContainer.innerHTML = '';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await previewTimetable();
  const deptEl = document.getElementById('departmentSelect');
  if (deptEl) {
    deptEl.value = '';
    deptEl.addEventListener('change', updateTeacherSelect);
  }
  const teacherSelect = document.getElementById('teacherSelect');
  if (teacherSelect) {
    updateTeacherSelect();
    const firstIdx = Array.from(teacherSelect.options).findIndex(o => o.value);
    teacherSelect.selectedIndex = firstIdx >= 0 ? firstIdx : 0;
    const tablesContainer = document.getElementById('timetableTables');
    if (tablesContainer) tablesContainer.innerHTML = '';
    teacherSelect.addEventListener('change', (e) => updatePreview(e.target.value));
    if (teacherSelect.value) updatePreview(teacherSelect.value);
  }
});

function updatePreview(teacherId) {
  const previewSection = document.getElementById('previewSection');
  if (!previewSection) return;
  let tablesContainer = document.getElementById('timetableTables');
  if (!tablesContainer) {
    tablesContainer = document.createElement('div');
    tablesContainer.id = 'timetableTables';
    previewSection.appendChild(tablesContainer);
  }
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
    if (subject.name.includes('HBL') || subject.name.includes('Home Based Learning')) return;
    const classIds = (lesson.getAttribute('classids') || '').split(',').filter(Boolean);
    const classNames = classIds.length > 3 ? 'Multiple Classes' : classIds.map(id => mappings.classes[id]?.name || 'Unknown').join(', ');
    const cards = xmlData.querySelectorAll(`card[lessonid="${lessonId}"]`);
    const dayGroups = new Map();
    cards.forEach(card => {
      const daysPattern = card.getAttribute('days');
      const periodId = parseInt(card.getAttribute('period'));
      const roomIds = (card.getAttribute('classroomids') || '').split(',').filter(Boolean);
      const rooms = roomIds.map(id => mappings.rooms[id]?.name || 'Unknown');
      const roomDisplay = rooms.length > 2 ? 'Multiple Venues' : rooms.join(' & ');
      let weekPatterns;
      if (weeksdefId === '4CEEF5CAAC1CEE35') weekPatterns = ['11'];
      else if (weeksdefId === 'F20BB99A3CE4D221') weekPatterns = ['01'];
      else if (weeksdefId === '1DE69DF37257B010') weekPatterns = ['10'];
      else weekPatterns = [card.getAttribute('weeks')];
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
            if (periodId === group.endPeriod + 1) group.endPeriod = periodId;
          }
        }
      });
    });
    dayGroups.forEach((group, key) => {
      const startPeriodInfo = mappings.periods[group.startPeriod];
      const endPeriodInfo = mappings.periods[group.endPeriod];
      const weekType = group.weeks === '11' ? 'Every Week' : group.weeks === '10' ? 'Odd Week' : group.weeks === '01' ? 'Even Week' : 'Every Week';
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
  const createRow = entry => `
    <tr>
      <td>${days[entry.day]}</td>
      <td>${entry.startTime} - ${entry.endTime}</td>
      <td>${entry.subject}${entry.className ? ` (${entry.className})` : ''}</td>
      <td>${entry.room}</td>
      <td>${entry.weekType}</td>
    </tr>
  `;
  const oddWeekLessons = lessonEntries.filter(entry => entry.weekType === 'Odd Week' || entry.weekType === 'Every Week');
  const evenWeekLessons = lessonEntries.filter(entry => entry.weekType === 'Even Week' || entry.weekType === 'Every Week');
  if (oddWeekTable) {
    oddWeekTable.innerHTML = oddWeekLessons.length ? oddWeekLessons.map(createRow).join('') : '<tr><td colspan="5">No lessons found for this week</td></tr>';
  }
  if (evenWeekTable) {
    evenWeekTable.innerHTML = evenWeekLessons.length ? evenWeekLessons.map(createRow).join('') : '<tr><td colspan="5">No lessons found for this week</td></tr>';
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
  const firstWeekDate = new Date(startDate);
  lessons.forEach(lesson => {
    const lessonId = lesson.getAttribute('id');
    const subjectId = lesson.getAttribute('subjectid');
    const subject = mappings.subjects[subjectId] || { name: 'Unknown', short: 'Unknown' };
    const weeksdefId = lesson.getAttribute('weeksdefid');
    if (subject.name.includes('HBL') || subject.name.includes('Home Based Learning')) return;
    const cards = xmlData.querySelectorAll(`card[lessonid="${lessonId}"]`);
    const dayGroups = new Map();
    cards.forEach(card => {
      const daysPattern = card.getAttribute('days');
      const periodId = parseInt(card.getAttribute('period'));
      let weekPatterns;
      if (weeksdefId === '4CEEF5CAAC1CEE35') weekPatterns = ['11'];
      else if (weeksdefId === 'F20BB99A3CE4D221') weekPatterns = ['01'];
      else if (weeksdefId === '1DE69DF37257B010') weekPatterns = ['10'];
      else weekPatterns = [card.getAttribute('weeks')];
      weekPatterns.forEach(weeks => {
        for (let dayIndex = 0; dayIndex < daysPattern.length; dayIndex++) {
          if (daysPattern[dayIndex] !== '1') continue;
          const key = `${dayIndex}-${weeks}`;
          if (!dayGroups.has(key)) {
            dayGroups.set(key, { startPeriod: periodId, endPeriod: periodId, weeks, dayIndex, card });
          } else {
            const group = dayGroups.get(key);
            if (periodId === group.endPeriod + 1) group.endPeriod = periodId;
          }
        }
      });
    });
    dayGroups.forEach(group => {
      const weekType = group.weeks === '11' ? 'every' : group.weeks === '10' ? 'odd' : group.weeks === '01' ? 'even' : 'every';
      if ((weekType === 'odd' && !showOddWeeks) || (weekType === 'even' && !showEvenWeeks)) return;
      const roomIds = (group.card.getAttribute('classroomids') || '').split(',').filter(Boolean);
      const rooms = roomIds.map(id => mappings.rooms[id]?.name || 'Unknown');
      const roomDisplay = rooms.length > 2 ? 'Multiple Venues' : rooms.join(' & ');
      const classIds = (lesson.getAttribute('classids') || '').split(',').filter(Boolean);
      const classNames = classIds.length > 3 ? 'Multiple Classes' : classIds.map(id => mappings.classes[id]?.name || 'Unknown').join(', ');
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
      vevent.addPropertyWithValue('dtstart', ICAL.Time.fromJSDate(startTime)).setParameter('tzid', 'Asia/Singapore');
      vevent.addPropertyWithValue('dtend', ICAL.Time.fromJSDate(endTime)).setParameter('tzid', 'Asia/Singapore');
      vevent.addPropertyWithValue('dtstamp', ICAL.Time.fromJSDate(new Date()));
      vevent.addPropertyWithValue('location', roomDisplay);
      vevent.addPropertyWithValue('description', classNames);
      vevent.addPropertyWithValue('status', 'CONFIRMED');
      const uidValue = `${lessonId}-${group.dayIndex}-${group.weeks}-${group.startPeriod}-${group.endPeriod}-${roomIds.join('_')}`;
      vevent.addPropertyWithValue('uid', uidValue);
      const untilDate = new Date(endDate);
      untilDate.setHours(23, 59, 59);
      const recur = new ICAL.Recur({
        freq: 'WEEKLY',
        interval: weeksdefId === '4CEEF5CAAC1CEE35' ? 1 : 2,
        byday: [['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][targetDayIndex]],
        until: ICAL.Time.fromJSDate(untilDate)
      });
      vevent.addPropertyWithValue('rrule', recur);
      cal.addSubcomponent(vevent);
    });
  });
  return cal;
};

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
};
