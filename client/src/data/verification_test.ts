// Testing the data flow trace
console.log('=== Signal ID & Group Verification ===');

// Test 1: Module mapping
const timelinessSCHMapping = MODULE_NAME_MAPPING['timeliness_sch'];
console.log('✓ MODULE_NAME_MAPPING["timeliness_sch"]:', timelinessSCHMapping);

// Test 2: Group extraction  
const groups = getSignalGroups('Timeliness – SCH');
console.log('✓ Groups for Timeliness – SCH:', groups);

// Test 3: Signal IDs for first group
const diagnosisSignals = getSignalsForModule('Timeliness – SCH').filter(s => s.group === 'Diagnosis');
console.log('✓ Diagnosis signals:', diagnosisSignals.map(s => s.id));

// Test 4: All signal IDs for module
const allSignalIds = getSignalsForModule('Timeliness – SCH').map(s => s.id);
console.log('✓ All SCH signal IDs:', allSignalIds);

export { timelinessSCHMapping, groups, diagnosisSignals, allSignalIds };
