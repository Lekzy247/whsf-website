variable "aws_region" {
  description = "AWS region for WHSF platform resources."
  type        = string
}

variable "environment" {
  description = "Deployment environment."
  type        = string
  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "environment must be development, staging, or production."
  }
}
