from controllers.user_controller import UserController
from controllers.admin_controller import AdminController
from services.user_service import UserService
from services.order_service import OrderService
from repositories.user_repo import UserRepo
from repositories.admin_repo import AdminRepo
from domain.models import User

class GodModule:
    def do_everything(self):
        return [
            UserController(),
            AdminController(),
            UserService(),
            OrderService(),
            UserRepo(),
            AdminRepo(),
            User('test'),
        ]
