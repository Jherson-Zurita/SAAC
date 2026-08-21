from services.order_service import OrderService

class UserRepo:
    def get(self):
        return OrderService().process()
