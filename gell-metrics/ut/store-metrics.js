class MetricStore {

	async querySubject(z) {
		return []
	}

	async queryType(z) {
		return []
	}

	async active(z) {
		return []
	}

	async query(z) {
		return []
	}

	async update(metric) {
		return metric;
	}
	
}

exports.MetricStore = MetricStore;
exports.metricStore = deps => new MetricStore();