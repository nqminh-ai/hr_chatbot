"""Mock persona lookup using the same immutable snapshot as the answer engine."""
from engine.snapshot import plain


class IdentityService:
    def __init__(self, snapshot):
        self.snapshot = snapshot

    def get_user_profile(self, user_id):
        if not isinstance(user_id, str):
            return None
        profile = self.snapshot.personas.get(user_id.casefold())
        return plain(profile) if profile is not None else None

    def list_users(self):
        """Demo-only chooser; a production adapter must use authenticated sessions."""
        return plain(self.snapshot.personas)
