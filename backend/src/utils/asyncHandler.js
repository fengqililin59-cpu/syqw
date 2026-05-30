/**
 * @file 将 async 路由处理器包装为自动 catch 并交给 next(err) 的函数。
 */
export function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    return Promise.resolve(fn(req, res, next)).catch(next);
  };
}
