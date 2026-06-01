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
    role: Literal["customer", "admin"] = "customer"
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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ProductIn(BaseModel):
    name: str
    description: str = ""
    price: float
    unit: str = "ea"
    category: str
    image_url: str = ""
    stock: int = 100


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    unit: Optional[str] = None
    category: Optional[str] = None
    image_url: Optional[str] = None
    stock: Optional[int] = None


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


OrderStatus = Literal["pending", "accepted", "out_for_delivery", "delivered", "cancelled"]


class OrderStatusUpdate(BaseModel):
    status: OrderStatus


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
