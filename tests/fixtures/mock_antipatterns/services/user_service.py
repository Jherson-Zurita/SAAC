from repositories.user_repo import UserRepo
from controllers.admin_controller import AdminController

class UserService:
    def find(self):
        return UserRepo().get()
