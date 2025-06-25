# Firebase Cloud Functions Security Documentation

This document outlines the security measures implemented in the Waffle app's Cloud Functions, following Firebase security best practices for production deployment.

## Security Measures Implemented

### 1. Authentication & Authorization

- **Required Authentication**: All callable functions require valid Firebase Authentication tokens
- **User Authorization**: Functions validate that users can only access resources they own or are members of
- **Input Validation**: All user inputs are sanitized to prevent injection attacks
- **Security Logging**: All authentication attempts and security events are logged for monitoring

### 2. Rate Limiting

- **Request Throttling**: HTTP functions implement rate limiting (100 requests per minute per IP by default)
- **Abuse Prevention**: Prevents DoS attacks and API abuse
- **Configurable Limits**: Rate limits can be adjusted via environment variables

### 3. CORS & Origin Validation

- **Allowed Origins**: Only approved domains can make requests to HTTP functions
- **Development vs Production**: Stricter validation in production environment
- **Mobile App Support**: Includes Capacitor/Cordova origins for mobile app access

### 4. App Check Integration (Ready for Production)

- **Token Verification**: Functions are prepared to validate Firebase App Check tokens
- **Authentic App Validation**: Ensures requests come from genuine app installations
- **Configurable Enforcement**: Can be enabled/disabled via environment variables

### 5. Data Access Controls

- **Chat Membership Validation**: Users can only access chats they're members of
- **Resource Ownership**: Functions verify user ownership before allowing operations
- **Firestore Security Rules**: Database-level security rules provide additional protection

## Security Configuration

### Environment Variables

Key security-related environment variables:

```bash
NODE_ENV=production                    # Enables stricter security in production
ENFORCE_APP_CHECK=true                # Requires App Check tokens
RATE_LIMIT_WINDOW=60000               # Rate limit window (ms)
MAX_REQUESTS_PER_WINDOW=100           # Max requests per window
ALLOWED_ORIGINS=https://waffle.app    # Comma-separated allowed origins
```

### Firebase Functions Config

For production deployment, use Firebase Functions config:

```bash
# Enable App Check enforcement
firebase functions:config:set app.enforce_app_check=true

# Set stricter rate limits for production
firebase functions:config:set security.rate_limit_window=30000
firebase functions:config:set security.max_requests=50

# Configure allowed origins
firebase functions:config:set security.allowed_origins="https://waffle.app,https://www.waffle.app"
```

## Security Rules

### Firestore Security Rules

Our Firestore rules implement:
- User authentication requirements
- Chat membership validation
- Video access controls based on chat membership
- Prevention of unauthorized data access

### Cloud Storage Security Rules

Our Storage rules implement:
- Chat-based access control
- User authentication requirements
- File organization by chat ID
- Prevention of unauthorized file access

## Security Monitoring

### Logged Security Events

The following security events are automatically logged:

- `chat_creation_attempt` - When users attempt to create chats
- `unauthorized_chat_creation` - When users try to create chats they shouldn't
- `user_stats_request` - When users request their statistics
- Failed authentication attempts
- Rate limit violations
- Invalid origin requests

### Log Analysis

Monitor logs for:
- Repeated failed authentication attempts
- Unusual access patterns
- Rate limit violations
- Invalid App Check tokens (in production)

## Production Deployment Checklist

### Before Production Deployment

- [ ] Enable App Check in Firebase Console
- [ ] Set `NODE_ENV=production` in environment
- [ ] Configure strict rate limits
- [ ] Set allowed origins to production domains only
- [ ] Enable security event logging
- [ ] Test all security measures in staging environment

### After Production Deployment

- [ ] Monitor security logs for unusual activity
- [ ] Set up alerts for security events
- [ ] Verify App Check is working correctly
- [ ] Test rate limiting behavior
- [ ] Confirm CORS policies are working

## Security Best Practices

### For Developers

1. **Never bypass authentication checks** in production code
2. **Always sanitize user input** before processing
3. **Log security events** for monitoring and debugging
4. **Use environment-specific configurations** for different deployment stages
5. **Regularly review and update security rules**

### For Operations

1. **Monitor security logs** regularly
2. **Set up alerts** for security violations
3. **Keep Firebase SDK and dependencies updated**
4. **Regularly audit access permissions**
5. **Test security measures** after each deployment

## Incident Response

If a security incident is detected:

1. **Immediate Response**: Review security logs to understand the scope
2. **Containment**: Use Firebase Console to disable affected functions if necessary
3. **Investigation**: Analyze logs to determine attack vector and impact
4. **Remediation**: Apply fixes and redeploy with enhanced security
5. **Prevention**: Update security rules and monitoring to prevent similar incidents

## Contact & Support

For security-related questions or to report vulnerabilities:
- Review Firebase Security Documentation
- Check Google Cloud Security Center
- Monitor Firebase Console for security alerts

---

*This security documentation should be reviewed and updated regularly as new security features are implemented or threats are identified.* 