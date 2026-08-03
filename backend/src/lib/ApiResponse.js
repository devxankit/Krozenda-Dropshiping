// Normalised success envelope — every controller responds via this so
// clients get one consistent shape whether the payload is a single record,
// a list, or nothing at all.
export class ApiResponse {
  constructor(statusCode, data, message = 'Success') {
    this.statusCode = statusCode
    this.success = statusCode < 400
    this.message = message
    this.data = data
  }

  send(res) {
    return res.status(this.statusCode).json({ success: this.success, message: this.message, data: this.data })
  }
}
