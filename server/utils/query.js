import db from "../config/db.js";

function queryAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (error, rows) => (error ? reject(error) : resolve(rows)));
    });
}

function queryGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (error, row) => (error ? reject(error) : resolve(row)));
    });
}

function queryRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (error) {
            error ? reject(error) : resolve(this);
        });
    });
}

function withTransaction(transactionBody) {
	return new Promise((resolve, reject) => {
		db.serialize(async () => {
			try {
				await queryRun('BEGIN TRANSACTION');
				const result = await transactionBody();
				await queryRun('COMMIT');
				resolve(result);
			} catch (err) {
				try { await queryRun('ROLLBACK'); }
				catch (e) { err.rollbackError = e; }
				reject(err);
			}
		});
	});
}

export { queryAll, queryGet, queryRun, withTransaction }