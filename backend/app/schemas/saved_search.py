from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class SavedSearchCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    q: str | None = Field(default=None, max_length=150)
    location: str | None = Field(default=None, max_length=150)
    company: str | None = Field(default=None, max_length=150)
    salary: str | None = Field(default=None, max_length=100)

    @model_validator(mode="after")
    def require_search_filter(self):
        if not any((self.q, self.location, self.company, self.salary)):
            raise ValueError("Add at least one search filter before creating an alert.")
        return self


class SavedSearchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    q: str | None
    location: str | None
    company: str | None
    salary: str | None
    created_at: datetime
