/**
 * API Wrapper for Backend communication
 */

export const api = {
    async fetchHistory() {
        const res = await fetch('/api/v1/history');
        return await res.json();
    },

    async fetchObjects(setId) {
        const res = await fetch(`/api/v1/objects/${setId}`);
        return await res.json();
    },

    async deleteHistoryItem(setId) {
        return await fetch(`/api/v1/history/${setId}`, { method: 'DELETE' });
    },

    async clearAllHistory() {
        return await fetch('/api/v1/history', { method: 'DELETE' });
    },

    async uploadXml(file) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/v1/upload', { method: 'POST', body: fd });
        if (!res.ok) {
            const e = await res.json();
            throw new Error(e.detail || res.statusText);
        }
        return await res.json();
    },

    async fetchPolicies(setId, parentPath = '') {
        const res = await fetch(`/api/v1/policies/${setId}?parent_path=${encodeURIComponent(parentPath)}`);
        return await res.json();
    },

    async searchPolicies(setId, params = {}) {
        // params can be a string (legacy) or an object with filter options
        const { query = '', enabled = '', exact = '0', fields = 'all', limit = 500 } =
            typeof params === 'string' ? { query: params } : params;
        const qs = new URLSearchParams({ query, enabled, exact, fields, limit });
        const res = await fetch(`/api/v1/policies/${setId}/search?${qs}`);
        return await res.json();
    },

    async fetchDiff(setA, setB) {
        const res = await fetch(`/api/v1/diff?set_a=${setA}&set_b=${setB}`);
        if (!res.ok) {
            const e = await res.json();
            throw new Error(e.detail || res.statusText);
        }
        return await res.json();
    },

    async fetchValueLookup(setId, value) {
        const res = await fetch(`/api/v1/analysis/${setId}/value-lookup?value=${encodeURIComponent(value)}`);
        return await res.json();
    },

    async fetchTopHosts(setId, limit = 200) {
        const res = await fetch(`/api/v1/analysis/${setId}/top-hosts?limit=${limit}`);
        return await res.json();
    },

    async fetchPolicyStats(setId) {
        const res = await fetch(`/api/v1/analysis/${setId}/policy-stats`);
        return await res.json();
    }
};
