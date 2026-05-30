/**
 * @file 统一 JSON 响应格式：{ code, message, data }。
 * @description Sequelize/MySQL BIGINT 在 Node 中常为 BigInt，Express 的 res.json 会抛错，此处统一转为 Number。
 */
function jsonSafe(payload) {
  return JSON.parse(
    JSON.stringify(payload, (_key, value) => {
      if (typeof value === 'bigint') {
        return Number(value);
      }
      return value;
    }),
  );
}

export function ok(res, data = null, message = 'ok') {
  return res.json(jsonSafe({ code: 0, message, data }));
}

export function fail(res, code, message, data = null, httpStatus = 200) {
  return res.status(httpStatus).json(jsonSafe({ code, message, data }));
}

export function paginated(list, total, page, size) {
  return { list, total, page, size };
}
