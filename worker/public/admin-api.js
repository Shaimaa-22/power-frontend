export async function requestApi(url, options = {}, onUnauthorized = () => {}) {
  let response;
  try {
    response = await fetch(url, { ...options, signal: options.signal || AbortSignal.timeout(30000) });
  } catch (error) {
    throw new Error(error.name === 'TimeoutError' ? 'انتهت مهلة الطلب، حاولي مرة أخرى' : 'تعذر الاتصال بالسيرفر، تحققي من الاتصال');
  }
  let data;
  try { data = await response.clone().json(); } catch { /* Fall back to a safe status message. */ }
  if (!response.ok) {
    if (response.status === 401) onUnauthorized();
    const error = new Error(typeof data?.error === 'string' ? data.error : `فشل الطلب (${response.status})`);
    error.status = response.status;
    throw error;
  }
  if (response.status !== 204 && (!data || typeof data !== 'object')) throw new Error('استجابة السيرفر غير صالحة');
  return response;
}

export async function responseRows(response) {
  const data = await response.json();
  if (!Array.isArray(data) || data.some(row => !row || !Number.isSafeInteger(row.id) || row.id < 1)) {
    throw new Error('استجابة السيرفر غير صالحة');
  }
  return data;
}
