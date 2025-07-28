// models/errors.go
package models

// RequestError represents an error caused by a bad client request.
type RequestError struct {
	Message string
	Status  int
}

func (e *RequestError) Error() string {
	return e.Message
}

func NewRequestError(message string, status int) *RequestError {
	return &RequestError{Message: message, Status: status}
}

// InternalError represents a server-side error.
type InternalError struct {
	Message string
}

func (e *InternalError) Error() string {
	return e.Message
}

func NewInternalError(message string) *InternalError {
	return &InternalError{Message: message}
}
