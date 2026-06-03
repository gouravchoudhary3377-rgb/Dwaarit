"""All Pydantic schemas in one place for easy import."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Literal, Optional

from pydantic import BaseModel, EmailStr, Field


# ---------- Users / Auth ----------
class UserPublic(BaseModel):
    user_id: str
    email: EmailStr
    name: str
    role: Literal["customer", "admin", "super_admin", "store_manager", "rider"] = "customer"
    auth_provider: Literal["password", "google"] = "password"
    picture: Optional[str] = None
    mobile: Optional[str] = None
    mobile_verified: bool = False


class SignupIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    token: str
    user: UserPublic


class GoogleSessionIn(BaseModel):
    session_id: str


class ProfileUpdateIn(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    picture: Optional[str] = None


class MobileSendOTPIn(BaseModel):
    mobile: str = Field(min_length=8, max_length=15)


class MobileVerifyOTPIn(BaseModel):
    mobile: str = Field(min_length=8, max_length=15)
    otp: str = Field(min_length=4, max_length=8)


class ChangePasswordIn(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=6)


# ---------- Catalog ----------
class Product(BaseModel):
    product_id: str = Field(default_factory=lambda: f"prod_{uuid.uuid4().hex[:12]}")
    name: str
    description: str = ""
    price: float
    unit: str = "ea"
    category: str
    image_url: str = ""
    stock: int = 100
    # Blinkit-style merchandising fields (optional)
    mrp: Optional[float] = None
    selling_price: Optional[float] = None  # price after discount displayed on storefront
    self_price: Optional[float] = None     # cost price, super_admin only
    discount_percent: Optional[int] = None
    delivery_eta_min: Optional[int] = 18
    rating: Optional[float] = None
    rating_count: Optional[int] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ProductIn(BaseModel):
    name: str
    description: str = ""
    price: float
    unit: str = "ea"
    category: str
    image_url: str = ""
    stock: int = 100
    mrp: Optional[float] = None
    selling_price: Optional[float] = None
    self_price: Optional[float] = None
    discount_percent: Optional[int] = None
    delivery_eta_min: Optional[int] = 18


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    unit: Optional[str] = None
    category: Optional[str] = None
    image_url: Optional[str] = None
    stock: Optional[int] = None
    mrp: Optional[float] = None
    selling_price: Optional[float] = None
    self_price: Optional[float] = None
    discount_percent: Optional[int] = None
    delivery_eta_min: Optional[int] = None


class Category(BaseModel):
    slug: str
    name: str
    icon: str = ""
    gallery: List[str] = Field(default_factory=list)
    is_default: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    icon: str = ""
    gallery: List[str] = Field(default_factory=list)


# ---------- Addresses ----------
AddressLabel = Literal["home", "work", "other"]


class AddressIn(BaseModel):
    label: AddressLabel = "home"
    custom_label: str = ""  # Used when label == "other"
    full_name: str
    phone: str
    line1: str
    line2: str = ""
    landmark: str = ""
    city: str
    pincode: str
    state: str = ""
    lat: Optional[float] = None
    lng: Optional[float] = None
    is_default: bool = False


class AddressOut(AddressIn):
    address_id: str
    user_id: str
    created_at: datetime


# ---------- Orders ----------
class CartItemIn(BaseModel):
    product_id: str
    quantity: int = Field(ge=1)


PaymentMethodLiteral = Literal["cod", "card", "upi", "wallet", "razorpay"]


class OrderIn(BaseModel):
    items: List[CartItemIn]
    address: AddressIn
    payment_method: PaymentMethodLiteral = "cod"
    notes: str = ""
    use_wallet: bool = False  # apply wallet balance toward total
    coupon_code: Optional[str] = None  # Blinkit-style promo code


OrderStatus = Literal["pending", "accepted", "out_for_delivery", "delivered", "cancelled"]


class OrderStatusUpdate(BaseModel):
    status: OrderStatus
    otp: Optional[str] = None  # Required when transitioning to "delivered"


# ---------- Order Chat ----------
class ChatMessageIn(BaseModel):
    content: str = Field(min_length=1, max_length=500)


# ---------- Wishlist ----------
class WishlistAddIn(BaseModel):
    product_id: str


# ---------- Wallet ----------
WalletTxnType = Literal["credit", "debit", "refund", "topup"]


class WalletAddIn(BaseModel):
    amount: float = Field(gt=0)
    note: str = ""


# ---------- Payments ----------
class RazorpayCreateOrderIn(BaseModel):
    amount: float = Field(gt=0)  # in INR (we convert to paise)
    order_id: Optional[str] = None  # our internal order id (optional link)


class RazorpayVerifyIn(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    order_id: Optional[str] = None


class WalletRazorpayVerifyIn(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    amount: float = Field(gt=0)  # INR amount user topped up


class SavePaymentMethodIn(BaseModel):
    kind: Literal["card", "upi"]
    label: str = ""
    # tokenised display info only — NEVER raw card data
    last4: Optional[str] = None
    brand: Optional[str] = None
    vpa: Optional[str] = None  # for UPI
    token: Optional[str] = None  # provider-issued token (mock if absent)


# ---------- Support / Chat ----------
class SupportChatIn(BaseModel):
    ticket_id: Optional[str] = None
    message: str = Field(min_length=1, max_length=2000)


# ---------- Drivers / Riders ----------
DriverStatus = Literal["pending", "approved", "rejected", "suspended"]
VehicleType = Literal["bike", "scooter", "bicycle", "ev", "car"]


class DriverDocs(BaseModel):
    license_no: str = ""
    license_image: str = ""  # base64 data URL
    aadhaar_no: str = ""
    aadhaar_image: str = ""
    pan_no: str = ""
    pan_image: str = ""
    rc_no: str = ""
    rc_image: str = ""
    insurance_no: str = ""
    insurance_image: str = ""


class DriverIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    phone: str = Field(min_length=8, max_length=15)
    password: str = Field(min_length=6)
    vehicle_type: VehicleType = "bike"
    vehicle_number: str = ""
    store_id: Optional[str] = None
    docs: Optional[DriverDocs] = None


class DriverUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    vehicle_type: Optional[VehicleType] = None
    vehicle_number: Optional[str] = None
    store_id: Optional[str] = None
    status: Optional[DriverStatus] = None
    docs: Optional[DriverDocs] = None
    is_online: Optional[bool] = None


class RiderLocationIn(BaseModel):
    lat: float
    lng: float


class RiderOnlineIn(BaseModel):
    online: bool


# ---------- Stores ----------
class StoreIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    code: str = ""
    address: str = ""
    city: str = ""
    pincode: str = ""
    lat: Optional[float] = None
    lng: Optional[float] = None
    phone: Optional[str] = None
    manager_email: Optional[EmailStr] = None


class StoreUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    pincode: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    phone: Optional[str] = None
    manager_id: Optional[str] = None
    is_active: Optional[bool] = None


# ---------- Order Assignment ----------
class OrderAssignIn(BaseModel):
    driver_id: str


# ---------- Rider Application (public onboarding) ----------
class RiderApplicationIn(BaseModel):
    name: str
    email: EmailStr
    phone: str
    city: str
    vehicle_type: VehicleType = "bike"
    note: str = ""


# ---------- Coupons / Promo Codes (Blinkit-style) ----------
CouponType = Literal["percent", "flat"]


class CouponIn(BaseModel):
    code: str = Field(min_length=2, max_length=24)
    title: str = ""
    description: str = ""
    discount_type: CouponType = "percent"
    value: float = Field(gt=0)            # 10 = 10% or ₹10 depending on type
    min_order_value: float = 0.0
    max_discount: Optional[float] = None  # only for percent
    usage_limit: Optional[int] = None     # global total
    per_user_limit: Optional[int] = 1
    active: bool = True
    expires_at: Optional[datetime] = None


class CouponUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    discount_type: Optional[CouponType] = None
    value: Optional[float] = None
    min_order_value: Optional[float] = None
    max_discount: Optional[float] = None
    usage_limit: Optional[int] = None
    per_user_limit: Optional[int] = None
    active: Optional[bool] = None
    expires_at: Optional[datetime] = None


class CouponValidateIn(BaseModel):
    code: str
    subtotal: float = Field(ge=0)


# ---------- Banners (Admin Carousel) ----------
BannerMediaType = Literal["image", "video"]


class BannerIn(BaseModel):
    title: str = ""
    media_type: BannerMediaType = "image"
    media_url: str = ""           # base64 data URL for image, or remote URL for video
    link_url: str = ""            # optional deep-link / category
    order: int = 0
    active: bool = True


class BannerUpdate(BaseModel):
    title: Optional[str] = None
    media_type: Optional[BannerMediaType] = None
    media_url: Optional[str] = None
    link_url: Optional[str] = None
    order: Optional[int] = None
    active: Optional[bool] = None
