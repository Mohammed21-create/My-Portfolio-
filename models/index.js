const mongoose = require('mongoose');
const { Schema, model } = mongoose;
const opts = { timestamps: true };
const str = (max = 200) => ({ type: String, trim: true, maxlength: max });
const httpUrl = { validator: v => !v || /^https?:\/\/\S+$/i.test(v), message: 'Must be a valid http(s) URL' };
const imgSchema = new Schema({
  url: { type: String, validate: { validator: v => !v || /^(https:\/\/|\/uploads\/)/.test(v), message: 'Invalid image URL' } },
  publicId: String
}, { _id: false });
const urlField = { type: String, trim: true, maxlength: 500, validate: httpUrl };

const Admin = model('Admin', new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^\S+@\S+\.\S+$/ },
  name: str(80),
  passwordHash: { type: String, required: true },
  loginAttempts: { type: Number, default: 0 },
  lockUntil: Date,
  lastLoginAt: Date
}, opts));

const projectSchema = new Schema({
  name: { ...str(120), required: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  shortDescription: str(300),
  description: { type: String, maxlength: 20000 },
  category: { ...str(60), index: true },
  technologies: [str(40)],
  mainImage: imgSchema,
  images: [imgSchema],
  features: [str(200)],
  developmentStatus: { type: String, enum: ['Planning', 'In Development', 'Completed', 'Maintenance'], default: 'In Development' },
  githubUrl: urlField,
  liveUrl: urlField,
  startDate: Date,
  completionDate: Date,
  featured: { type: Boolean, default: false },
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  publishedAt: Date,
  deletedAt: { type: Date, default: null }
}, opts);
projectSchema.index({ status: 1, deletedAt: 1, featured: -1, publishedAt: -1 });
projectSchema.pre('save', function (next) { if (this.status === 'published' && !this.publishedAt) this.publishedAt = new Date(); next(); });
const Project = model('Project', projectSchema);

const skillSchema = new Schema({
  name: { ...str(60), required: true, unique: true },
  category: { type: String, required: true, enum: ['Frontend Development', 'Backend Development', 'Database Management', 'Tools and Deployment', 'Programming Languages', 'Automation and AI'] },
  learningStatus: { type: String, enum: ['Learning', 'Practicing', 'Experienced'], default: 'Practicing' },
  icon: imgSchema,
  iconText: str(8),
  order: { type: Number, default: 0 }
}, opts);
skillSchema.index({ category: 1, order: 1 });
const Skill = model('Skill', skillSchema);

const Profile = model('Profile', new Schema({
  fullName: str(100), title: str(120), bio: { type: String, maxlength: 5000 }, location: str(120),
  intro: { type: String, maxlength: 2000 }, careerGoals: { type: String, maxlength: 3000 },
  strengths: [str(120)], education: [str(300)], nssExperience: { type: String, maxlength: 4000 },
  photo: imgSchema,
  linkedin: urlField, github: urlField, twitter: urlField, youtube: urlField, whatsapp: str(30),
  email: { ...str(150), match: [/^$|^\S+@\S+\.\S+$/, 'Invalid email'] }, phone: str(40)
}, opts));

const journalSchema = new Schema({
  title: { ...str(160), required: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  excerpt: str(400),
  content: { type: String, maxlength: 60000 },
  coverImage: imgSchema,
  category: { ...str(60), index: true },
  tags: [str(40)],
  status: { type: String, enum: ['draft', 'published', 'scheduled'], default: 'draft' },
  publishAt: Date,
  publishedAt: Date
}, opts);
journalSchema.index({ status: 1, publishAt: 1, publishedAt: -1 });
journalSchema.pre('validate', function (next) {
  if (this.status === 'published' && this.publishAt && this.publishAt > new Date()) this.status = 'scheduled';
  if (this.status === 'scheduled' && !this.publishAt) this.status = 'draft';
  next();
});
journalSchema.pre('save', function (next) {
  if (this.status === 'published' && !this.publishedAt) this.publishedAt = new Date();
  next();
});
const JournalPost = model('JournalPost', journalSchema);
const visibleJournal = () => ({ $or: [{ status: 'published' }, { status: 'scheduled', publishAt: { $lte: new Date() } }] });

const msgSchema = new Schema({
  name: { ...str(100), required: true },
  email: { ...str(150), required: true },
  subject: str(150),
  message: { type: String, required: true, maxlength: 5000 },
  isRead: { type: Boolean, default: false },
  archived: { type: Boolean, default: false },
  ip: String, userAgent: String
}, opts);
msgSchema.index({ archived: 1, isRead: 1, createdAt: -1 });
const ContactMessage = model('ContactMessage', msgSchema);

const sec = { type: Boolean, default: true };
const PortfolioSettings = model('PortfolioSettings', new Schema({
  portfolioName: { ...str(100), default: 'My Portfolio' },
  logo: imgSchema, favicon: imgSchema,
  description: str(500), seoTitle: str(70), seoDescription: str(170),
  contactEmail: str(150), phone: str(40), githubUrl: urlField, linkedinUrl: urlField, whatsapp: str(30),
  theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'auto' },
  accentColor: { type: String, match: /^#[0-9a-fA-F]{6}$/, default: '#6366f1' },
  footerText: str(300),
  availability: { type: String, enum: ['available', 'limited', 'unavailable'], default: 'available' },
  availabilityNote: str(200),
  sections: { about: sec, skills: sec, projects: sec, journal: sec, cv: sec, contact: sec }
}, opts));

const fileSchema = new Schema({
  url: { type: String, required: true },
  publicId: String,
  storage: { type: String, enum: ['cloudinary', 'local'], required: true },
  resourceType: { type: String, enum: ['image', 'raw'], default: 'image' },
  originalName: str(200), mimeType: String, size: Number,
  purpose: { type: String, enum: ['project', 'gallery', 'profile', 'journal', 'cv', 'branding', 'media'], default: 'media' },
  isActiveCv: { type: Boolean, default: false }
}, opts);
fileSchema.index({ purpose: 1, createdAt: -1 });
const UploadedFile = model('UploadedFile', fileSchema);

module.exports = { Admin, Project, Skill, Profile, JournalPost, ContactMessage, PortfolioSettings, UploadedFile, visibleJournal };
