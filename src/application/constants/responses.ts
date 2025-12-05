export const RESPONSES = {
  ERRORS: {
    // Follow/Unfollow Errors
    CANNOT_FOLLOW_SELF: { message: "Cannot follow yourself", status: 400 },
    ALREADY_FOLLOWING: {
      message: "You are already following this user",
      status: 400,
    },
    NOT_FOLLOWING_USER: {
      message: "You are not following this user",
      status: 400,
    },
    NO_FOLLOW_REQUEST_FOUND: {
      message: "No follow request found",
      status: 404,
    },
    FOLLOW_ALREADY_ACCEPTED: {
      message: "Follow request already accepted",
      status: 409,
    },
    CANNOT_FOLLOW_BLOCKED_USER: {
      message: "Cannot follow a user you have blocked or who has blocked you",
      status: 403,
    },

    // Block/Mute Errors
    CANNOT_BLOCK_SELF: { message: "Cannot block yourself", status: 400 },
    ALREADY_BLOCKING: {
      message: "You are already blocking this user",
      status: 400,
    },
    NOT_BLOCKED: { message: "You have not blocked this user", status: 400 },
    CANNOT_MUTE_SELF: { message: "Cannot mute yourself", status: 400 },
    ALREADY_MUTING: {
      message: "You are already muting this user",
      status: 400,
    },
    NOT_MUTING: { message: "You are not muting this user", status: 400 },
    MUTE_BLOCKED_USER: {
      message: "Can't mute blocked users /users who blocked you",
      status: 403,
    },
    BLOCKED_FOLLOWERS: {
      message: "Cannot view followers of blocked users or who have blocked you",
      status: 403,
    },
    BLOCKED_FOLLOWINGS: {
      message:
        "Cannot view followings of blocked users or who have blocked you",
      status: 403,
    },

    // Authorization Errors
    UNAUTHORIZED: {
      message: "You must be logged in to follow users",
      status: 401,
    },
    UNAUTHORIZED_ACCESS: { message: "Unauthorized access", status: 401 },
    UNAUTHORIZED_USER: {
      message: "Unauthorized: user not authenticated",
      status: 401,
    },
    UNAUTHORIZED_MISSING_USER_ID: {
      message: "Unauthorized: Missing user ID",
      status: 401,
    },
    USER_NOT_AUTHORIZED_FOR_ROUTE: {
      message: "User is not authorized for this route",
      status: 401,
    },
    REAUTHENTICATION_REQUIRED: {
      message: "Reauthentication required to access user info",
      status: 401,
    },

    // User Errors
    NOT_FOUND: { message: "User not found", status: 404 },
    CONFLICT: { message: "Conflict occurred", status: 409 },
    INVALID_SEARCH_QUERY: { message: "Invalid search query", status: 400 },
    INVALID_HASHTAG_ID: { message: "Invalid hashtag ID", status: 400 },
    INVALID_QUERY_PARAMETERS: {
      message: "Invalid query parameters",
      status: 400,
    },
    INVALID_REQUEST_PARAMETERS: {
      message: "Invalid request parameters",
      status: 400,
    },
    INVALID_INPUT_DATA: { message: "Invalid input data", status: 400 },
    PHOTO_URL_REQUIRED: { message: "Photo URL is required", status: 400 },
    INVALID_REQUEST_BODY: { message: "Invalid request body", status: 400 },
    FORBIDDEN_UPDATE_OWN_PROFILE: {
      message: "Forbidden: you can only update your own profile",
      status: 403,
    },
    FORBIDDEN_UPDATE_OWN_PROFILE_PICTURE: {
      message: "Forbidden: you can only update your own profile picture",
      status: 403,
    },

    // Registration/Signup Errors
    EMAIL_ALREADY_IN_USE: { message: "Email already in use", status: 409 },
    THIS_EMAIL_ALREADY_IN_USE: {
      message: "This email is already in use",
      status: 409,
    },
    MISSING_REQUIRED_FIELDS: {
      message: "Missing required fields",
      status: 400,
    },
    INVALID_EMAIL_FORMAT: { message: "Invalid email format", status: 400 },
    MUST_SOLVE_CAPTCHA: {
      message: "You must solve Captcha first",
      status: 401,
    },
    EMAIL_AND_CODE_REQUIRED: {
      message: "Email and code are required",
      status: 400,
    },
    VERIFICATION_SESSION_EXPIRED: {
      message: "Verification session expired, please sign up again",
      status: 400,
    },
    VERIFICATION_CODE_INCORRECT: {
      message: "Verification code is incorrect",
      status: 401,
    },
    USER_DATA_NOT_FOUND: {
      message: "User data not found, please sign up again",
      status: 400,
    },
    VALID_EMAIL_REQUIRED: { message: "Valid email is required", status: 400 },
    USER_ID_REQUIRED: { message: "User ID is required", status: 400 },
    FAILED_TO_SEND_VERIFICATION_EMAIL: {
      message: "Failed to send verification email",
      status: 500,
    },
    FAILED_TO_SEND_WELCOME_EMAIL: {
      message: "Failed to send welcome email",
      status: 500,
    },

    // Login Errors
    EMAIL_AND_PASSWORD_REQUIRED: {
      message: "Email and password are required",
      status: 400,
    },
    VERIFY_EMAIL_FIRST: {
      message: "You must verify your email first",
      status: 400,
    },
    ENTER_VALID_EMAIL: { message: "Enter valid email", status: 403 },
    TRY_AGAIN_ENTER_INFO_CORRECTLY: {
      message: "Try again and enter your info correctly",
      status: 401,
    },
    INVALID_CREDENTIALS: { message: "Invalid credentials", status: 401 },
    FAILED_TO_SEND_LOGIN_NOTIFICATION: {
      message: "Failed to send login notification email",
      status: 500,
    },

    // Token Errors
    INVALID_REFRESH_TOKEN: { message: "Invalid refresh token", status: 401 },
    INVALID_REFRESH_TOKEN_CANNOT_RENEW: {
      message: "Invalid refresh token, cannot renew session",
      status: 401,
    },
    NO_AUTHORIZATION_HEADER: {
      message: "No Authorization header provided",
      status: 401,
    },
    TOKEN_MUST_START_WITH_BEARER: {
      message: "Token must start with Bearer",
      status: 401,
    },
    INVALID_TOKEN_SIGNATURE: {
      message: "Invalid token signature",
      status: 401,
    },
    TOKEN_AND_REFRESH_SAME: {
      message: "Token and refresh token cannot be the same",
      status: 401,
    },

    // Password Reset Errors
    EMAIL_REQUIRED: { message: "Email is required", status: 400 },
    EMAIL_AND_RESET_CODE_REQUIRED: {
      message: "Email and reset code are required",
      status: 400,
    },
    RESET_CODE_EXPIRED_OR_NOT_FOUND: {
      message: "Reset code expired or not found",
      status: 400,
    },
    INVALID_RESET_CODE: { message: "Invalid reset code", status: 401 },
    EMAIL_AND_NEW_PASSWORD_REQUIRED: {
      message: "Email and new password are required",
      status: 400,
    },
    FAILED_TO_SEND_RESET_CODE: {
      message: "Failed to send reset code email",
      status: 500,
    },
    FAILED_TO_SEND_PASSWORD_CHANGE_NOTIFICATION: {
      message: "Failed to send password change notification",
      status: 500,
    },
    FAILED_TO_SEND_PASSWORD_CHANGE_EMAIL: {
      message: "Failed to send password change email",
      status: 500,
    },

    // Password Update Errors
    PASSWORD_REQUIRED: { message: "password are required", status: 400 },
    ENTER_PASSWORD_CORRECTLY: {
      message: "Enter password correctly",
      status: 401,
    },
    EMAIL_NOT_IN_SYSTEM: { message: "Email is not in system", status: 401 },
    CODE_NOT_CORRECT: {
      message: "Code is not correct, try again",
      status: 401,
    },
    ENTER_CODE_CORRECTLY: {
      message: "Enter code correctly, try again",
      status: 401,
    },
    OLD_PASSWORD_INCORRECT: {
      message: "Old password is incorrect",
      status: 401,
    },
    NEW_PASSWORD_NOT_STRONG_ENOUGH: {
      message: "Your new password is not strong enough",
      status: 401,
    },

    // Email Change Errors
    MUST_PROVIDE_CURRENT_EMAIL: {
      message: "Must provide your current email",
      status: 401,
    },
    NEW_EMAIL_DIFFERENT: {
      message: "New email must be different than the old one",
      status: 401,
    },
    INPUT_EMAIL_NOT_VALID: { message: "Input email is not valid", status: 401 },
    CURRENT_EMAIL_REQUIRED: {
      message: "Current email is required",
      status: 401,
    },
    VERIFICATION_CODE_REQUIRED: {
      message: "Verification code is required",
      status: 400,
    },
    VERIFICATION_CODE_NOT_FOUND_OR_EXPIRED: {
      message: "Verification code not found or expired",
      status: 400,
    },
    INCORRECT_VERIFICATION_CODE: {
      message: "Incorrect verification code",
      status: 401,
    },
    EMAIL_MISMATCH: { message: "Email mismatch", status: 401 },

    // Username Errors
    USERNAME_LENGTH: {
      message: "Username must be between 3 and 20 characters",
      status: 400,
    },
    USERNAME_ALREADY_TAKEN: {
      message: "Username is already taken",
      status: 400,
    },
    SAME_USERNAME: {
      message: "you Entered the same username you have",
      status: 400,
    },

    // OAuth Errors
    AUTHORIZATION_CODE_PROCESSING: {
      message: "This authorization code is already being processed",
      status: 400,
    },
    AUTHORIZATION_CODE_MISSING: {
      message: "Authorization code is missing",
      status: 400,
    },
    UNSUPPORTED_PROVIDER: { message: "Unsupported provider", status: 400 },
    GITHUB_OAUTH_ERROR: { message: "GitHub OAuth error", status: 400 },
    INVALID_STATE_PARAMETER: {
      message: "Invalid state parameter - possible CSRF attack",
      status: 400,
    },
    FAILED_TO_OBTAIN_ACCESS_TOKEN_GITHUB: {
      message: "Failed to obtain access token from GitHub",
      status: 500,
    },
    FAILED_TO_EXCHANGE_GOOGLE_CODE: {
      message: "Failed to exchange Google code",
      status: 500,
    },
    NO_ACCESS_TOKEN_GITHUB: {
      message: "No access token received from GitHub",
      status: 500,
    },
    NO_VERIFIED_EMAIL_FOUND: {
      message: "No verified email found",
      status: 400,
    },
    INVALID_ID_TOKEN: { message: "Invalid ID token", status: 401 },
    ID_TOKEN_REQUIRED: { message: "idToken is required", status: 400 },
    EMAIL_IS_REQUIRED: { message: "email is required", status: 400 },

    // Session Errors
    SESSION_ID_AND_USER_ID_REQUIRED: {
      message: "Session ID and User ID are required",
      status: 400,
    },
    FAILED_TO_PARSE_SESSION_DATA: {
      message: "Failed to parse session data",
      status: 500,
    },
    ERROR_READING_SESSION_KEY: {
      message: "Error reading session key",
      status: 500,
    },

    // Chat/Message Errors
    CHAT_ID_REQUIRED: { message: "Chat ID is required", status: 400 },
    INVALID_CHAT_ID: { message: "invalid chatId", status: 404 },
    CHAT_ID_AND_LASTMESSAGE_REQUIRED: {
      message: "Chat ID and lastMessage timestamp are required",
      status: 400,
    },
    MISSING_CHAT_TYPE_OR_PARTICIPANTS: {
      message: "Missing chat type or participants id",
      status: 400,
    },
    PARTICIPANTS_REQUIRED_FOR_GROUP_CHAT: {
      message: "At least two participants are required to create a chat group",
      status: 400,
    },
    USER_NOT_FOUND_WITH_ID: {
      message: "User with specified ID not found",
      status: 404,
    },
    MESSAGE_CONTENT_REQUIRED: {
      message: "Message content is required",
      status: 400,
    },
    MISSING_CHAT_ID_OR_RECIPIENT_ID: {
      message: "missing chatId or recipientId",
      status: 400,
    },

    // Media Errors
    MEDIA_NOT_FOUND: { message: "Media not found", status: 404 },
    TWEET_ID_REQUIRED: { message: "tweetId is required", status: 400 },
    MESSAGE_ID_REQUIRED: { message: "messageId is required", status: 400 },
    MEDIA_IDS_MUST_BE_NON_EMPTY_ARRAY: {
      message: "mediaIds must be a non-empty array",
      status: 400,
    },
    NO_MEDIA_FOUND_FOR_TWEET: {
      message: "No media found for this tweet",
      status: 404,
    },
    NO_MEDIA_FOUND_FOR_MESSAGE: {
      message: "No media found for this message",
      status: 404,
    },
  },
  SUCCESS: {
    // Follow/Unfollow
    FOLLOW_REQUEST_SENT: { message: "Follow request sent", status: 202 },
    SUCCESSFULLY_FOLLOWED_USER: {
      message: "Successfully followed user",
      status: 201,
    },
    FOLLOW_REQUEST_ACCEPTED: {
      message: "Follow request accepted",
      status: 200,
    },
    FOLLOW_REQUEST_CANCELLED: {
      message: "Follow request cancelled",
      status: 202,
    },
    UNFOLLOWED_USER: {
      message: "Successfully unfollowed user",
      status: 200,
    },
    FOLLOW_REQUEST_DECLINED: {
      message: "Follow request declined",
      status: 202,
    },
    FOLLOWER_REMOVED: {
      message: "Follower removed",
      status: 200,
    },

    // User Profile
    PROFILE_UPDATED: { message: "Profile updated successfully", status: 200 },
    PROFILE_PICTURE_UPDATED: {
      message: "Profile picture updated successfully",
      status: 200,
    },
    PROFILE_PICTURE_REMOVED: {
      message: "Profile picture removed successfully",
      status: 200,
    },
    PROFILE_BANNER_UPDATED: {
      message: "Profile banner updated successfully",
      status: 200,
    },
    PROFILE_BANNER_RESTORED: {
      message: "Profile banner restored to default",
      status: 200,
    },
    FCM_TOKEN_ADDED: { message: "FCM token added successfully", status: 200 },
    USERNAME_UPDATED: {
      message: "Username updated successfully ",
      status: 200,
    },

    // Authentication
    USER_REGISTERED: {
      message:
        "User registered successfully. Please verify your email to continue.",
      status: 200,
    },
    EMAIL_ALREADY_VERIFIED: { message: "Email already verified", status: 200 },
    CAPTCHA_PASSED_REGISTER: {
      message: "You passed the Captcha, you can register now",
      status: 200,
    },
    CAPTCHA_PASSED_LOGIN: {
      message: "You passed the Captcha, you can login now",
      status: 200,
    },
    EMAIL_VERIFIED: {
      message: "Email verified successfully, please set your password.",
      status: 200,
    },
    SIGNUP_COMPLETE: { message: "Signup complete. Welcome!", status: 200 },
    LOGIN_SUCCESSFUL: {
      message: "Login successful, email & in-app notification sent",
      status: 200,
    },
    LOGGED_OUT: { message: "Logged out successfully", status: 200 },
    SESSION_LOGGED_OUT: {
      message: "Session logged out successfully",
      status: 200,
    },
    ALL_SESSIONS_LOGGED_OUT: {
      message: "You logged out all sessions successfully",
      status: 200,
    },

    // Password Management
    RESET_CODE_SENT: {
      message: "Reset code sent via email. Check your inbox!",
      status: 200,
    },
    RESET_CODE_VERIFIED: {
      message: "Reset code verified, you can now enter a new password",
      status: 200,
    },
    PASSWORD_RESET: {
      message: "Password reset successfully, notification sent!",
      status: 200,
    },
    PASSWORD_UPDATED: { message: "Password updated successfully", status: 200 },
    CAN_CHANGE_CREDENTIALS: {
      message: "You can change your credentials now",
      status: 200,
    },

    // Email Management
    VERIFICATION_CODE_SENT_NEW_EMAIL: {
      message: "Verification code sent successfully to your new email",
      status: 200,
    },
    EMAIL_CHANGED: { message: "Email changed successfully", status: 200 },

    // User Info
    USER_INFO_WITH_DEVICE_HISTORY: {
      message: "User info returned with device history",
      status: 200,
    },

    // User Interactions
    USER_MUTED: { message: "User muted successfully", status: 201 },
    USER_UNMUTED: { message: "User unmuted successfully", status: 200 },
    USER_BLOCKED: { message: "User blocked successfully", status: 201 },
    USER_UNBLOCKED: { message: "User unblocked successfully", status: 200 },

    // Tweets
    TWEET_DELETED: { message: "Tweet deleted successfuly", status: 200 },
    RETWEET_DELETED: { message: "Retweet deleted successfuly", status: 200 },
    TWEET_UPDATED: { message: "Tweet updated successfully", status: 200 },
    TWEET_LIKED: { message: "Tweet liked successfully", status: 200 },
    TWEET_UNLIKED: { message: "Tweet unliked successfully", status: 200 },

    // Media
    MEDIA_ADDED_TO_TWEET: {
      message: "Media added to tweet successfully",
      status: 200,
    },
    MEDIA_ADDED_TO_MESSAGE: {
      message: "Media added to message successfully",
      status: 200,
    },

    // Messages/Chat
    CHAT_DELETED: { message: "Chat deleted successfully", status: 200 },

    // Notifications
    NOTIFICATION_SENT: {
      message: "Notification sent successfully",
      status: 200,
    },
  },
};
