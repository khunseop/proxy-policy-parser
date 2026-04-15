/**
 * Global State Management
 */
export const state = {
    currentSetId: null,
    objectsMap: {},         // list_id -> { name, type, entries[] }
    objectsNameToId: {},    // list_name -> list_id
    activeListId: null,
    currentTab: 'policies',
    currentPath: '',        // currently browsed policy parent-path
    isSearchMode: false,
    selectedPk: null,       // _pk_auto of selected policy row
    listRefPolicies: [],
    searchTimer: null,
    currentViewData: [],    // currently displayed policy nodes (for CSV export)

    listSearchMode: 'name', // 'name' | 'value'
    listSearchTimer: null,

    statsData: [],
    statsSortedData: [],
    statsSortCol: 'policy_count',
    statsSortDir: 'desc',
    policyStats: null,

    // Diff 상태
    diffData: null,         // 마지막 diff 결과
    diffSetA: null,         // 비교 A set_id
    diffSetB: null,         // 비교 B set_id
    diffSection: null,      // 현재 섹션: 'pol_added'|'pol_removed'|'pol_changed'|'lst_added'|'lst_removed'|'lst_changed'
};
