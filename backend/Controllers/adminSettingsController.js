const PlatformSettings = require('../Models/PlatformSettings');
const AccountingConfig = require('../Models/AccountingConfig');

async function getGeneralSettings(req, res) {
  try {
    const [platform, accounting] = await Promise.all([
      PlatformSettings.getSettings(),
      AccountingConfig.resolve(),
    ]);

    res.json({
      success: true,
      message: 'General settings fetched successfully',
      data: {
        platform: {
          name: platform.name,
          legalEntity: platform.legalEntity,
          gstin: platform.gstin,
          registeredAddress: platform.registeredAddress,
          supportEmail: platform.supportEmail,
          supportPhone: platform.supportPhone,
          footerTagline: platform.footerTagline,
          copyrightText: platform.copyrightText,
          socialLinks: platform.socialLinks || {
            whatsapp: 'https://whatsapp.com',
            instagram: 'https://instagram.com',
            linkedin: 'https://linkedin.com',
            twitter: 'https://twitter.com',
            youtube: 'https://youtube.com',
            facebook: 'https://facebook.com',
          },
          quickLinks: platform.quickLinks,
          customerLinks: platform.customerLinks,
          legalLinks: platform.legalLinks,
          timezone: platform.timezone,
          currency: platform.currency,
          defaultCommissionPercent: accounting?.defaultCommissionPercent ?? platform.defaultCommissionPercent,
          commissionRate: platform.commissionRate ?? accounting?.defaultCommissionPercent ?? platform.defaultCommissionPercent ?? 10,
          commissionType: platform.commissionType || 'percentage',
          defaultGstRate: platform.defaultGstRate ?? 18,
          gstRate: platform.gstRate ?? platform.defaultGstRate ?? 18,
          gstType: platform.gstType || 'percentage',
          gstOnCommissionRate: platform.gstOnCommissionRate,
          commissionBase: accounting?.commissionBase ?? platform.commissionBase,
        },
        toggles: [
          {
            key: 'seller_self_registration',
            label: 'Seller self-registration',
            description: 'Marketplace sellers can sign up without an invitation. Dropshipping partners are always added by an admin.',
            enabled: true,
          },
          {
            key: 'b2b_pricing',
            label: 'B2B tiered pricing',
            description: 'Dealers, distributors and wholesalers resolve their own price tier at checkout.',
            enabled: true,
          },
          {
            key: 'guest_checkout',
            label: 'Guest checkout',
            description: 'Buyers can complete an order without registering. A mobile number is still required.',
            enabled: false,
          },
          {
            key: 'reviews',
            label: 'Product reviews',
            description: 'Buyers can rate and review a delivered product. Reviews go to moderation first.',
            enabled: true,
          },
          {
            key: 'maintenance',
            label: 'Maintenance mode',
            description: 'Storefront shows a holding page. The admin panel stays reachable.',
            enabled: false,
          },
        ],
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch settings' });
  }
}

async function updateGeneralSettings(req, res) {
  try {
    const platform = await PlatformSettings.getSettings();
    const {
      name,
      legalEntity,
      gstin,
      registeredAddress,
      supportEmail,
      supportPhone,
      footerTagline,
      copyrightText,
      socialLinks,
      quickLinks,
      customerLinks,
      legalLinks,
      timezone,
      defaultCommissionPercent,
      commissionRate,
      commissionType,
      defaultGstRate,
      gstRate,
      gstType,
      gstOnCommissionRate,
      commissionBase,
    } = req.body;

    if (name !== undefined) platform.name = name;
    if (legalEntity !== undefined) platform.legalEntity = legalEntity;
    if (gstin !== undefined) platform.gstin = gstin;
    if (registeredAddress && typeof registeredAddress === 'object') {
      for (const field of ['addressLine', 'city', 'state', 'pincode']) {
        if (registeredAddress[field] !== undefined) {
          platform.registeredAddress[field] = String(registeredAddress[field]).trim();
        }
      }
    }
    if (supportEmail !== undefined) platform.supportEmail = supportEmail;
    if (supportPhone !== undefined) platform.supportPhone = supportPhone;
    if (footerTagline !== undefined) platform.footerTagline = footerTagline;
    if (copyrightText !== undefined) platform.copyrightText = copyrightText;

    if (socialLinks !== undefined && typeof socialLinks === 'object') {
      platform.socialLinks = {
        whatsapp: socialLinks.whatsapp !== undefined ? String(socialLinks.whatsapp).trim() : (platform.socialLinks?.whatsapp || ''),
        instagram: socialLinks.instagram !== undefined ? String(socialLinks.instagram).trim() : (platform.socialLinks?.instagram || ''),
        linkedin: socialLinks.linkedin !== undefined ? String(socialLinks.linkedin).trim() : (platform.socialLinks?.linkedin || ''),
        twitter: socialLinks.twitter !== undefined ? String(socialLinks.twitter).trim() : (platform.socialLinks?.twitter || ''),
        youtube: socialLinks.youtube !== undefined ? String(socialLinks.youtube).trim() : (platform.socialLinks?.youtube || ''),
        facebook: socialLinks.facebook !== undefined ? String(socialLinks.facebook).trim() : (platform.socialLinks?.facebook || ''),
      };
    }

    if (Array.isArray(quickLinks)) platform.quickLinks = quickLinks;
    if (Array.isArray(customerLinks)) platform.customerLinks = customerLinks;
    if (Array.isArray(legalLinks)) platform.legalLinks = legalLinks;

    if (timezone !== undefined) platform.timezone = timezone;

    if (commissionType !== undefined && ['percentage', 'flat'].includes(commissionType)) {
      platform.commissionType = commissionType;
    }

    if (commissionRate !== undefined) {
      const num = Number(commissionRate);
      if (Number.isFinite(num) && num >= 0) {
        platform.commissionRate = num;
        if (platform.commissionType === 'percentage') {
          platform.defaultCommissionPercent = Math.min(100, num);
          await AccountingConfig.findOneAndUpdate(
            { key: 'GLOBAL' },
            { $set: { defaultCommissionPercent: Math.min(100, num), updatedBy: req.admin?._id || null } },
            { upsert: true }
          );
        }
      }
    } else if (defaultCommissionPercent !== undefined) {
      const num = Number(defaultCommissionPercent);
      if (Number.isFinite(num) && num >= 0 && num <= 100) {
        platform.defaultCommissionPercent = num;
        platform.commissionRate = num;
        await AccountingConfig.findOneAndUpdate(
          { key: 'GLOBAL' },
          { $set: { defaultCommissionPercent: num, updatedBy: req.admin?._id || null } },
          { upsert: true }
        );
      }
    }

    if (gstType !== undefined && ['percentage', 'flat'].includes(gstType)) {
      platform.gstType = gstType;
    }

    if (gstRate !== undefined) {
      const num = Number(gstRate);
      if (Number.isFinite(num) && num >= 0) {
        platform.gstRate = num;
        if (platform.gstType === 'percentage') {
          platform.defaultGstRate = Math.min(100, num);
        }
      }
    } else if (defaultGstRate !== undefined) {
      const num = Number(defaultGstRate);
      if (Number.isFinite(num) && num >= 0 && num <= 100) {
        platform.defaultGstRate = num;
        platform.gstRate = num;
      }
    }

    if (gstOnCommissionRate !== undefined) {
      const num = Number(gstOnCommissionRate);
      if (Number.isFinite(num) && num >= 0 && num <= 100) {
        platform.gstOnCommissionRate = num;
      }
    }

    if (commissionBase !== undefined && AccountingConfig.COMMISSION_BASES.includes(commissionBase)) {
      platform.commissionBase = commissionBase;
      await AccountingConfig.findOneAndUpdate(
        { key: 'GLOBAL' },
        { $set: { commissionBase, updatedBy: req.admin?._id || null } },
        { upsert: true }
      );
    }

    platform.updatedBy = req.admin?._id || null;
    await platform.save();

    res.json({
      success: true,
      message: 'General settings updated successfully',
      data: {
        platform: {
          name: platform.name,
          legalEntity: platform.legalEntity,
          gstin: platform.gstin,
          registeredAddress: platform.registeredAddress,
          supportEmail: platform.supportEmail,
          supportPhone: platform.supportPhone,
          footerTagline: platform.footerTagline,
          copyrightText: platform.copyrightText,
          socialLinks: platform.socialLinks,
          quickLinks: platform.quickLinks,
          customerLinks: platform.customerLinks,
          legalLinks: platform.legalLinks,
          timezone: platform.timezone,
          currency: platform.currency,
          defaultCommissionPercent: platform.defaultCommissionPercent,
          defaultGstRate: platform.defaultGstRate,
          gstOnCommissionRate: platform.gstOnCommissionRate,
          commissionBase: platform.commissionBase,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update settings' });
  }
}

async function getPublicSettings(req, res) {
  try {
    const platform = await PlatformSettings.getSettings();
    res.json({
      success: true,
      message: 'Public settings fetched successfully',
      data: {
        name: platform.name,
        supportEmail: platform.supportEmail || 'support@krozenda.com',
        supportPhone: platform.supportPhone || '+91 98765 43210',
        footerTagline:
          platform.footerTagline ||
          'B2B wholesale and dropshipping marketplace connecting retailers with direct factory prices and express delivery.',
        copyrightText: platform.copyrightText
          ? platform.copyrightText.replace(/\{year\}/gi, new Date(Date.now()).getFullYear())
          : `© ${new Date(Date.now()).getFullYear()} KroZenda Technologies Pvt Ltd. All rights reserved.`,
        socialLinks: platform.socialLinks || {
          whatsapp: 'https://whatsapp.com',
          instagram: 'https://instagram.com',
          linkedin: 'https://linkedin.com',
          twitter: 'https://twitter.com',
          youtube: 'https://youtube.com',
          facebook: 'https://facebook.com',
        },
        quickLinks: platform.quickLinks?.length ? platform.quickLinks : undefined,
        customerLinks: platform.customerLinks?.length ? platform.customerLinks : undefined,
        legalLinks: platform.legalLinks?.length ? platform.legalLinks : undefined,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch public settings' });
  }
}

module.exports = {
  getGeneralSettings,
  updateGeneralSettings,
  getPublicSettings,
};
