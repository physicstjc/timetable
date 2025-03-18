// Excluded dates configuration
const excludedDates = {
 
    // 2025 Public Holidays
    "2025-01-01": "New Year's Day",
    "2025-01-29": "Chinese New Year",
    "2025-01-30": "Chinese New Year",
    "2025-03-30": "Good Friday",
    "2025-03-31": "Hari Raya Puasa",
    "2025-05-01": "Labour Day",
    "2025-05-11": "Vesak Day",
    "2025-06-06": "Hari Raya Haji",
    "2025-08-09": "National Day",
    "2025-10-22": "Deepavali",
    "2025-12-25": "Christmas Day",

    // 2025 School Terms (tentative dates based on typical pattern)
    "2025-03-15": "Term 1 Break Start",
    "2025-03-23": "Term 1 Break End",
    "2025-05-31": "Term 2 Break Start",
    "2025-06-29": "Term 2 Break End",
    "2025-09-06": "Term 3 Break Start",
    "2025-09-14": "Term 3 Break End",
    "2025-11-29": "Term 4 Break Start",
    "2025-12-31": "Term 4 Break End",

    // Special School Days
    "2025-01-28": "CNY Celebrations",
    "2025-07-06": "Youth Day",
    "2025-09-04": "Staff Day Celebrations",
    "2025-09-05": "Staff Day",
};

function isExcludedDate(date) {
    const dateString = date.toISOString().split('T')[0];
    return dateString in excludedDates;
}

function getExcludedDates() {
    return excludedDates;
}

// Remove the displayExcludedDates function and event listener