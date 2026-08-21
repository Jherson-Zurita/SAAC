from services.user_service import UserService

class OrderService:
    def process(self):
        return UserService().find()
