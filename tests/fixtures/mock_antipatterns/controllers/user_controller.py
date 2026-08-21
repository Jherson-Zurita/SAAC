from services.user_service import UserService

class UserController:
    def get_user(self):
        return UserService().find()
